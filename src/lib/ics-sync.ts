import { ApiContext } from "@applicator/sdk/context";
import { EventRecord, TodoRecord } from "@/src/types";
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

  const { events, todos } = parseICS(icsContent);

  const eventsRm = context.recordManager<EventRecord>("calendars", "event");
  const todosRm = context.recordManager<TodoRecord>("calendars", "todo");

  const [existingEvents, existingTodos] = await Promise.all([
    eventsRm.readRecords({ fields: { calendarId }, limit: 5000 }),
    todosRm.readRecords({ fields: { calendarId }, limit: 5000 }),
  ]);

  const eventsToDelete = existingEvents.records.filter((r: any) => r.data.icsSubscriptionId === subscriptionId);
  const todosToDelete = existingTodos.records.filter((r: any) => r.data.icsSubscriptionId === subscriptionId);

  await Promise.all([
    eventsToDelete.length > 0 ? eventsRm.bulkDeleteRecords(eventsToDelete.map((r: any) => r.id)) : Promise.resolve(),
    todosToDelete.length > 0 ? todosRm.bulkDeleteRecords(todosToDelete.map((r: any) => r.id)) : Promise.resolve(),
  ]);

  const now = new Date().toISOString();
  const eventsTable = await eventsRm.getTable();
  for (const ev of events) {
    await eventsRm.createRecord(eventsTable, {
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

  const todosTable = await todosRm.getTable();
  for (const todo of todos) {
    await todosRm.createRecord(todosTable, {
      calendarId,
      summary: todo.summary,
      description: todo.description || "",
      due: todo.due || null,
      allDay: todo.allDay ?? true,
      status: todo.status,
      priority: todo.priority ?? null,
      completedAt: todo.completedAt || null,
      color,
      icsSubscriptionId: subscriptionId,
      icsUid: todo.uid,
      icsCategory: todo.icsCategory || null,
      createdBy,
      createdAt: now,
      updatedAt: now,
    } as any);
  }

  return events.length + todos.length;
}
