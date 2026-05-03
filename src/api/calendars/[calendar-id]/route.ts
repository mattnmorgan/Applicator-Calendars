import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { CalendarRecord } from "@/src/types";
import { getCalendarAccess, deleteAllCalendarShares } from "@/src/lib/calendar-access";

function calendarToData(record: any, role: string) {
  return {
    id: record.id,
    name: record.data.name,
    description: record.data.description || "",
    color: record.data.color || "#3B82F6",
    hasIcon: !!record.data.hasIcon,
    defaultView: record.data.defaultView || "week",
    ownerId: record.data.ownerId,
    icsToken: record.data.icsToken,
    role,
  };
}

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  return NextResponse.json(calendarToData(access.calendar, access.level));
}

export async function PATCH(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const mgr = context.recordManager<CalendarRecord>("calendars", "calendar");
    const table = await mgr.getTable();

    const updates: Partial<CalendarRecord> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.color !== undefined) updates.color = body.color;
    if (body.defaultView !== undefined) updates.defaultView = body.defaultView;

    const updated = await mgr.updateRecord(table, params.calendarId, updates as any);
    return NextResponse.json(calendarToData(updated, access.level));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const eventsRm = context.recordManager("calendars", "event");
    const remindersRm = context.recordManager("calendars", "reminder");
    const subsRm = context.recordManager("calendars", "ics_subscription");
    const categoriesRm = context.recordManager("calendars", "category");

    const eventResult = await eventsRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 5000 });
    const eventIds = eventResult.records.map((r: any) => r.id);

    if (eventIds.length > 0) {
      const reminderResult = await remindersRm.readRecords({ limit: 10000 });
      const reminderIds = reminderResult.records
        .filter((r: any) => eventIds.includes(r.data.eventId))
        .map((r: any) => r.id);

      if (reminderIds.length > 0) {
        await remindersRm.bulkDeleteRecords(reminderIds);
      }
      await eventsRm.bulkDeleteRecords(eventIds);
    }

    const subsResult = await subsRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 200 });
    if (subsResult.records.length > 0) {
      await subsRm.bulkDeleteRecords(subsResult.records.map((r: any) => r.id));
    }

    const catsResult = await categoriesRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 500 });
    if (catsResult.records.length > 0) {
      await categoriesRm.bulkDeleteRecords(catsResult.records.map((r: any) => r.id));
    }

    await deleteAllCalendarShares(context, params.calendarId);

    const calRm = context.recordManager("calendars", "calendar");
    await calRm.deleteRecord(params.calendarId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
