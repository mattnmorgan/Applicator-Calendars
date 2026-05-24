import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { EventRecord, EventData, TodoRecord, TodoData, TodoStatus } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";
import { generateICS } from "@/src/lib/ics";

function parseEventData(record: any): EventData {
  return {
    id: record.id,
    calendarId: record.data.calendarId,
    name: record.data.name,
    description: record.data.description,
    location: record.data.location,
    color: record.data.color,
    allDay: !!record.data.allDay,
    status: record.data.status || "free",
    startDate: record.data.startDate,
    endDate: record.data.endDate,
    isRecurring: !!record.data.isRecurring,
    recurrenceRule: record.data.recurrenceRule ? JSON.parse(record.data.recurrenceRule) : undefined,
    seriesId: record.data.seriesId,
    exceptionDate: record.data.exceptionDate,
    isException: !!record.data.isException,
    deletedOccurrences: record.data.deletedOccurrences ? JSON.parse(record.data.deletedOccurrences) : [],
    createdBy: record.data.createdBy,
    createdAt: record.data.createdAt,
    updatedAt: record.data.updatedAt,
  };
}

function parseTodoData(record: any): TodoData {
  return {
    id: record.id,
    calendarId: record.data.calendarId,
    summary: record.data.summary,
    description: record.data.description || undefined,
    due: record.data.due || undefined,
    allDay: !!record.data.allDay,
    status: (record.data.status || "needs-action") as TodoStatus,
    priority: record.data.priority != null ? Number(record.data.priority) : undefined,
    completedAt: record.data.completedAt || undefined,
    color: record.data.color || undefined,
    categoryId: record.data.categoryId || null,
    icsCategory: record.data.icsCategory || undefined,
    icsSubscriptionId: record.data.icsSubscriptionId || null,
    createdBy: record.data.createdBy,
    createdAt: record.data.createdAt,
    updatedAt: record.data.updatedAt,
  };
}

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  const eventsRm = context.recordManager<EventRecord>("calendars", "event");
  const todosRm = context.recordManager<TodoRecord>("calendars", "todo");

  const [evResult, todoResult] = await Promise.all([
    eventsRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 5000 }),
    todosRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 5000 }),
  ]);

  const events = evResult.records.map(parseEventData);
  const todos = todoResult.records.map(parseTodoData);

  const icsContent = generateICS(access.calendar.data.name, events, todos);

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(access.calendar.data.name)}.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
