/**
 * Reminder Check Agent — runs every 5 minutes.
 * For each reminder, checks if the associated event has an upcoming occurrence
 * within the reminder's minutesBefore window and notifies the user if not already sent.
 * Notifications are not sent for occurrences that have already transpired.
 */

function sdk<T = any>(method: string, params: Record<string, any>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const handler = (message: any) => {
      if (message.id === id) {
        process.removeListener("message", handler);
        if (message.error) reject(new Error(message.error));
        else resolve(message.result as T);
      }
    };
    process.addListener("message", handler);
    process.send!({ id, method, params });
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

interface RecurrenceRule {
  type: "weekly" | "interval";
  days?: number[];
  interval?: number;
  unit?: "day" | "week" | "month" | "year";
  endDate?: string;
}

function expandEventOccurrences(
  masterStart: Date,
  masterEnd: Date,
  rule: RecurrenceRule,
  deletedDates: Set<string>,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const duration = masterEnd.getTime() - masterStart.getTime();
  const ruleEnd = rule.endDate ? new Date(rule.endDate + "T23:59:59.999Z") : null;
  const occurrences: Date[] = [];
  const MAX_ITER = 500;

  if (rule.type === "weekly" && rule.days && rule.days.length > 0) {
    const sortedDays = [...rule.days].sort((a, b) => a - b);
    const masterDay = masterStart.getUTCDay();
    let weekSunday = new Date(Date.UTC(
      masterStart.getUTCFullYear(),
      masterStart.getUTCMonth(),
      masterStart.getUTCDate() - masterDay
    ));

    let iter = 0;
    outer: while (iter < MAX_ITER) {
      for (const day of sortedDays) {
        const occStart = new Date(Date.UTC(
          weekSunday.getUTCFullYear(),
          weekSunday.getUTCMonth(),
          weekSunday.getUTCDate() + day,
          masterStart.getUTCHours(),
          masterStart.getUTCMinutes(),
          0
        ));
        if (occStart < masterStart) continue;
        const occEnd = new Date(occStart.getTime() + duration);
        if (occStart >= rangeEnd) break outer;
        if (ruleEnd && occStart > ruleEnd) break outer;
        if (occEnd > rangeStart) {
          const ds = formatDate(occStart);
          if (!deletedDates.has(ds)) occurrences.push(occStart);
        }
      }
      weekSunday = new Date(weekSunday.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (weekSunday >= rangeEnd) break;
      iter++;
    }
  } else if (rule.type === "interval" && rule.interval && rule.unit) {
    let current = new Date(masterStart);
    let iter = 0;
    while (iter < MAX_ITER) {
      const occEnd = new Date(current.getTime() + duration);
      if (current >= rangeEnd) break;
      if (ruleEnd && current > ruleEnd) break;
      if (occEnd > rangeStart) {
        const ds = formatDate(current);
        if (!deletedDates.has(ds)) occurrences.push(new Date(current));
      }
      if (rule.unit === "day") current = addDays(current, rule.interval);
      else if (rule.unit === "week") current = addDays(current, rule.interval * 7);
      else if (rule.unit === "month") current = addMonths(current, rule.interval);
      else if (rule.unit === "year") current = addMonths(current, rule.interval * 12);
      iter++;
    }
  }
  return occurrences;
}

async function main() {
  await sdk("logger.info", { message: "Reminder check agent starting" });

  const now = new Date();

  const activeUsers = await sdk<any[]>("system.getUsers", { includeInactive: false });
  const activeUserIds = new Set(activeUsers.map((u: any) => u.id));

  const reminderResult = await sdk<{ records: any[] }>("records.list", {
    table: "reminder",
    limit: 10000,
  });

  if (reminderResult.records.length === 0) {
    await sdk("logger.info", { message: "No reminders configured" });
    process.exit(0);
    return;
  }

  const eventIds = [...new Set(reminderResult.records.map((r: any) => r.data.eventId))];
  const eventMap: Record<string, any> = {};

  for (const eventId of eventIds) {
    try {
      const ev = await sdk<any>("records.get", { table: "event", id: eventId });
      if (ev) eventMap[eventId] = ev;
    } catch {
      // event may have been deleted
    }
  }

  let notificationsSent = 0;

  for (const reminder of reminderResult.records) {
    const rd = reminder.data;
    if (!activeUserIds.has(rd.userId)) continue;

    const event = eventMap[rd.eventId];
    if (!event) continue;

    const ed = event.data;
    const minutesBefore: number = rd.minutesBefore;
    const windowEnd = new Date(now.getTime() + minutesBefore * 60 * 1000);
    const sentForDates: string[] = rd.sentForDates ? JSON.parse(rd.sentForDates) : [];
    const sentSet = new Set(sentForDates);

    let upcomingOccurrences: Date[] = [];

    if (!ed.isRecurring) {
      const start = new Date(ed.startDate);
      if (start >= now && start <= windowEnd) {
        upcomingOccurrences.push(start);
      }
    } else if (ed.recurrenceRule) {
      const rule: RecurrenceRule = JSON.parse(ed.recurrenceRule);
      const masterStart = new Date(ed.startDate);
      const masterEnd = new Date(ed.endDate);
      const deletedDates = new Set<string>(ed.deletedOccurrences ? JSON.parse(ed.deletedOccurrences) : []);
      upcomingOccurrences = expandEventOccurrences(
        masterStart,
        masterEnd,
        rule,
        deletedDates,
        now,
        windowEnd
      );
    }

    const newSentDates = [...sentForDates];
    for (const occStart of upcomingOccurrences) {
      const occKey = occStart.toISOString();
      if (sentSet.has(occKey)) continue;

      const minutesUntil = Math.round((occStart.getTime() - now.getTime()) / 60000);
      let timeLabel: string;
      if (minutesUntil <= 0) timeLabel = "now";
      else if (minutesUntil < 60) timeLabel = `in ${minutesUntil} minutes`;
      else timeLabel = `in ${Math.round(minutesUntil / 60)} hours`;

      try {
        await sdk("system.sendNotification", {
          userId: rd.userId,
          title: `Reminder: ${ed.name}`,
          message: `"${ed.name}" starts ${timeLabel}${ed.location ? ` at ${ed.location}` : ""}`,
          type: "info",
          topicId: "calendars:event-reminder",
        });

        newSentDates.push(occKey);
        sentSet.add(occKey);
        notificationsSent++;
      } catch (err: any) {
        await sdk("logger.warn", { message: `Failed to notify user ${rd.userId}: ${err.message}` });
      }
    }

    // Prune old sent dates (keep only last 90 days worth)
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const pruned = newSentDates.filter((d) => new Date(d) >= cutoff);

    if (pruned.length !== sentForDates.length || newSentDates.length !== sentForDates.length) {
      try {
        await sdk("records.update", {
          table: "reminder",
          id: reminder.id,
          data: { sentForDates: JSON.stringify(pruned) },
        });
      } catch (err: any) {
        await sdk("logger.warn", { message: `Failed to update sentForDates for reminder ${reminder.id}: ${err.message}` });
      }
    }
  }

  await sdk("logger.info", { message: `Reminder check complete — sent ${notificationsSent} notification(s)` });
  process.exit(0);
}

main().catch((err) => {
  console.error("Reminder check agent fatal error:", err);
  process.exit(1);
});
