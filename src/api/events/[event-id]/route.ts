import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { EventRecord, EventData } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";

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

async function getEventWithAccess(context: ApiContext, eventId: string) {
  const eventsRm = context.recordManager<EventRecord>("calendars", "event");
  const record = await eventsRm.readRecord(eventId);
  if (!record) return null;

  const access = await getCalendarAccess(context, (record.data as any).calendarId);
  if (!access) return null;

  return { record, access };
}

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { eventId: string }
) {
  const result = await getEventWithAccess(context, params.eventId);
  if (!result) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  return NextResponse.json(parseEventData(result.record));
}

export async function PATCH(
  req: NextRequest,
  context: ApiContext,
  params: { eventId: string }
) {
  const result = await getEventWithAccess(context, params.eventId);
  if (!result) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (result.access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const eventsRm = context.recordManager<EventRecord>("calendars", "event");
    const table = await eventsRm.getTable();
    const now = new Date().toISOString();

    const updates: Partial<EventRecord> = { updatedAt: now };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.location !== undefined) updates.location = body.location;
    if (body.color !== undefined) updates.color = body.color;
    if (body.allDay !== undefined) updates.allDay = body.allDay;
    if (body.status !== undefined) updates.status = body.status;
    if (body.startDate !== undefined) updates.startDate = body.startDate;
    if (body.endDate !== undefined) updates.endDate = body.endDate;
    if (body.isRecurring !== undefined) updates.isRecurring = body.isRecurring;
    if (body.recurrenceRule !== undefined) {
      updates.recurrenceRule = body.recurrenceRule ? JSON.stringify(body.recurrenceRule) : undefined;
    }

    const updated = await eventsRm.updateRecord(table, params.eventId, updates as any);
    return NextResponse.json(parseEventData(updated));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: ApiContext,
  params: { eventId: string }
) {
  const result = await getEventWithAccess(context, params.eventId);
  if (!result) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (result.access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") || "all";
    const occurrenceDate = url.searchParams.get("occurrenceDate");

    const eventsRm = context.recordManager<EventRecord>("calendars", "event");
    const remindersRm = context.recordManager("calendars", "reminder");

    if (scope === "one" && occurrenceDate && result.record.data.isRecurring) {
      const current = (result.record.data as any).deletedOccurrences
        ? JSON.parse((result.record.data as any).deletedOccurrences)
        : [];
      if (!current.includes(occurrenceDate)) {
        current.push(occurrenceDate);
        const table = await eventsRm.getTable();
        await eventsRm.updateRecord(table, params.eventId, {
          deletedOccurrences: JSON.stringify(current),
          updatedAt: new Date().toISOString(),
        } as any);
      }
      return NextResponse.json({ success: true });
    }

    if (scope === "following" && occurrenceDate && result.record.data.isRecurring) {
      const rule = (result.record.data as any).recurrenceRule
        ? JSON.parse((result.record.data as any).recurrenceRule)
        : {};
      const prevDate = new Date(occurrenceDate);
      prevDate.setUTCDate(prevDate.getUTCDate() - 1);
      const endDateStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}-${String(prevDate.getUTCDate()).padStart(2, "0")}`;
      rule.endDate = endDateStr;

      const table = await eventsRm.getTable();
      await eventsRm.updateRecord(table, params.eventId, {
        recurrenceRule: JSON.stringify(rule),
        updatedAt: new Date().toISOString(),
      } as any);
      return NextResponse.json({ success: true });
    }

    const reminderResult = await remindersRm.readRecords({ fields: { eventId: params.eventId }, limit: 500 });
    if (reminderResult.records.length > 0) {
      await remindersRm.bulkDeleteRecords(reminderResult.records.map((r: any) => r.id));
    }
    await eventsRm.deleteRecord(params.eventId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
