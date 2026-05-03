import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { CategoryRecord, CategoryData } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";

function categoryToData(record: any): CategoryData {
  return {
    id: record.id,
    calendarId: record.data.calendarId,
    name: record.data.name,
    color: record.data.color || "#3B82F6",
    ownerId: record.data.ownerId,
    createdAt: record.data.createdAt,
  };
}

async function getCategoryWithAccess(context: ApiContext, calendarId: string, categoryId: string) {
  const access = await getCalendarAccess(context, calendarId);
  if (!access) return null;

  const catRm = context.recordManager<CategoryRecord>("calendars", "category");
  const record = await catRm.readRecord(categoryId);
  if (!record || (record.data as any).calendarId !== calendarId) return null;

  return { record, access };
}

export async function PATCH(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string; categoryId: string }
) {
  const result = await getCategoryWithAccess(context, params.calendarId, params.categoryId);
  if (!result) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (result.access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const catRm = context.recordManager<CategoryRecord>("calendars", "category");

    if (body.name !== undefined) {
      const nameLower = body.name.trim().toLowerCase();
      const existing = await catRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 500 });
      if (existing.records.some((r: any) => r.id !== params.categoryId && (r.data.name as string).toLowerCase() === nameLower)) {
        return NextResponse.json({ error: "A category with that name already exists" }, { status: 409 });
      }
    }

    const table = await catRm.getTable();

    const updates: Partial<CategoryRecord> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.color !== undefined) updates.color = body.color;

    const updated = await catRm.updateRecord(table, params.categoryId, updates as any);
    return NextResponse.json(categoryToData(updated));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string; categoryId: string }
) {
  const result = await getCategoryWithAccess(context, params.calendarId, params.categoryId);
  if (!result) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (!["owner", "admin"].includes(result.access.level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") || "migrate";

    const eventsRm = context.recordManager("calendars", "event");
    const eventResult = await eventsRm.readRecords({
      fields: { calendarId: params.calendarId },
      limit: 5000,
    });
    const categoryEvents = eventResult.records.filter(
      (r: any) => r.data.categoryId === params.categoryId
    );

    if (scope === "delete") {
      if (categoryEvents.length > 0) {
        const remindersRm = context.recordManager("calendars", "reminder");
        const reminderResult = await remindersRm.readRecords({ limit: 10000 });
        const reminderIds = reminderResult.records
          .filter((r: any) => categoryEvents.some((e: any) => e.id === r.data.eventId))
          .map((r: any) => r.id);
        if (reminderIds.length > 0) {
          await remindersRm.bulkDeleteRecords(reminderIds);
        }
        await eventsRm.bulkDeleteRecords(categoryEvents.map((e: any) => e.id));
      }
    } else {
      const table = await eventsRm.getTable();
      for (const ev of categoryEvents) {
        await eventsRm.updateRecord(table, ev.id, { categoryId: null, updatedAt: new Date().toISOString() } as any);
      }
    }

    const catRm = context.recordManager("calendars", "category");
    await catRm.deleteRecord(params.categoryId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
