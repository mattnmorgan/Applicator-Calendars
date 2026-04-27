import { EventData, EventOccurrence, RecurrenceRule } from "@/src/types";
import { datetime } from "@applicator/sdk/utilities";

const { addDays, addMonths, startOfDayUTC, formatDate } = datetime;

function makeOccurrence(event: EventData, occStart: Date, occEnd: Date): EventOccurrence {
  return {
    id: event.id,
    calendarId: event.calendarId,
    occurrenceDate: formatDate(occStart),
    occurrenceStart: occStart.toISOString(),
    occurrenceEnd: occEnd.toISOString(),
    name: event.name,
    description: event.description,
    location: event.location,
    color: event.color,
    allDay: event.allDay,
    status: event.status,
    isRecurring: event.isRecurring,
    recurrenceRule: event.recurrenceRule,
    seriesId: event.seriesId,
    isException: event.isException,
  };
}

export function expandEvent(event: EventData, rangeStart: Date, rangeEnd: Date): EventOccurrence[] {
  const masterStart = new Date(event.startDate);
  const masterEnd = new Date(event.endDate);
  const duration = masterEnd.getTime() - masterStart.getTime();

  if (!event.isRecurring || !event.recurrenceRule) {
    if (masterStart < rangeEnd && masterEnd > rangeStart) {
      return [makeOccurrence(event, masterStart, masterEnd)];
    }
    return [];
  }

  const rule = event.recurrenceRule;
  const deletedDates = new Set<string>(event.deletedOccurrences || []);
  const ruleEnd = rule.endDate ? new Date(rule.endDate + "T23:59:59.999Z") : null;
  const occurrences: EventOccurrence[] = [];
  const MAX_ITER = 1000;

  if (rule.type === "weekly" && rule.days && rule.days.length > 0) {
    const sortedDays = [...rule.days].sort((a, b) => a - b);
    const masterDay = masterStart.getUTCDay();
    let weekSunday = startOfDayUTC(addDays(masterStart, -masterDay));

    let iter = 0;
    outer: while (iter < MAX_ITER) {
      for (const day of sortedDays) {
        const occDate = addDays(weekSunday, day);
        const occStart = new Date(Date.UTC(
          occDate.getUTCFullYear(),
          occDate.getUTCMonth(),
          occDate.getUTCDate(),
          masterStart.getUTCHours(),
          masterStart.getUTCMinutes(),
          masterStart.getUTCSeconds(),
          0
        ));

        if (occStart < masterStart) continue;

        const occEnd = new Date(occStart.getTime() + duration);

        if (occStart >= rangeEnd) break outer;
        if (ruleEnd && occStart > ruleEnd) break outer;

        if (occEnd > rangeStart) {
          const dateStr = formatDate(occStart);
          if (!deletedDates.has(dateStr)) {
            occurrences.push(makeOccurrence(event, occStart, occEnd));
          }
        }
      }

      weekSunday = addDays(weekSunday, 7);
      if (weekSunday >= rangeEnd) break;
      if (ruleEnd && weekSunday > ruleEnd) break;
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
        const dateStr = formatDate(current);
        if (!deletedDates.has(dateStr)) {
          occurrences.push(makeOccurrence(event, current, occEnd));
        }
      }

      switch (rule.unit) {
        case "day":
          current = addDays(current, rule.interval);
          break;
        case "week":
          current = addDays(current, rule.interval * 7);
          break;
        case "month":
          current = addMonths(current, rule.interval);
          break;
      }
      iter++;
    }
  }

  return occurrences;
}

export function getNextOccurrences(event: EventData, after: Date, limit = 10): Date[] {
  const rangeEnd = addDays(after, 366);
  const occurrences = expandEvent(event, after, rangeEnd);
  return occurrences
    .map((o) => new Date(o.occurrenceStart))
    .filter((d) => d >= after)
    .slice(0, limit);
}

function addDays2(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
