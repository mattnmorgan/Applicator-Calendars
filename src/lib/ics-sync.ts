import { ApiContext } from "@applicator/sdk/context";
import { EventRecord } from "@/src/types";
import { parseICS } from "./ics-parser";

export async function syncICSSubscription(
  context: ApiContext,
  subscriptionId: string,
  calendarId: string,
  url: string,
  color: string,
  createdBy: string
): Promise<number> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let icsContent: string;
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Failed to fetch ICS: HTTP ${res.status}`);
    icsContent = await res.text();
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }

  const events = parseICS(icsContent);

  const eventsRm = context.recordManager<EventRecord>("calendars", "event");
  const existing = await eventsRm.readRecords({ fields: { calendarId }, limit: 5000 });
  const toDelete = existing.records.filter((r: any) => r.data.icsSubscriptionId === subscriptionId);
  if (toDelete.length > 0) {
    await eventsRm.bulkDeleteRecords(toDelete.map((r: any) => r.id));
  }

  const now = new Date().toISOString();
  const table = await eventsRm.getTable();
  for (const ev of events) {
    await eventsRm.createRecord(table, {
      calendarId,
      name: ev.summary,
      description: ev.description || "",
      location: ev.location || "",
      color,
      allDay: ev.allDay,
      status: ev.status,
      startDate: ev.startDate,
      endDate: ev.endDate,
      isRecurring: false,
      icsSubscriptionId: subscriptionId,
      icsUid: ev.uid,
      createdBy,
      createdAt: now,
      updatedAt: now,
    } as any);
  }

  return events.length;
}
