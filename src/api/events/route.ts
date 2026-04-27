import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { EventRecord, EventData } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";
import { expandEvent } from "@/src/lib/recurrence";

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

export async function GET(req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const calIdsParam = url.searchParams.get("calendarIds") || "";
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");

  if (!startParam || !endParam) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const calIds = calIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (calIds.length === 0) return NextResponse.json({ events: [] });

  const rangeStart = new Date(startParam);
  const rangeEnd = new Date(endParam);
  const eventsRm = context.recordManager<EventRecord>("calendars", "event");
  const allOccurrences: any[] = [];

  for (const calId of calIds) {
    const access = await getCalendarAccess(context, calId);
    if (!access) continue;

    const result = await eventsRm.readRecords({ fields: { calendarId: calId }, limit: 2000 });
    for (const record of result.records) {
      const eventData = parseEventData(record);
      const occurrences = expandEvent(eventData, rangeStart, rangeEnd);
      allOccurrences.push(...occurrences);
    }
  }

  allOccurrences.sort((a, b) => a.occurrenceStart.localeCompare(b.occurrenceStart));
  return NextResponse.json({ events: allOccurrences });
}

export async function POST(req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.calendarId) return NextResponse.json({ error: "calendarId is required" }, { status: 400 });
    if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!body.startDate) return NextResponse.json({ error: "startDate is required" }, { status: 400 });
    if (!body.endDate) return NextResponse.json({ error: "endDate is required" }, { status: 400 });

    const access = await getCalendarAccess(context, body.calendarId);
    if (!access) return NextResponse.json({ error: "Calendar not found or access denied" }, { status: 404 });
    if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const eventsRm = context.recordManager<EventRecord>("calendars", "event");
    const table = await eventsRm.getTable();
    const now = new Date().toISOString();

    const record = await eventsRm.createRecord(table, {
      calendarId: body.calendarId,
      name: body.name.trim(),
      description: body.description || "",
      location: body.location || "",
      color: body.color || "",
      allDay: !!body.allDay,
      status: body.status || "free",
      startDate: body.startDate,
      endDate: body.endDate,
      isRecurring: !!body.isRecurring,
      recurrenceRule: body.recurrenceRule ? JSON.stringify(body.recurrenceRule) : null,
      seriesId: null,
      exceptionDate: null,
      isException: false,
      deletedOccurrences: "[]",
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    } as any);

    return NextResponse.json(parseEventData(record), { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
