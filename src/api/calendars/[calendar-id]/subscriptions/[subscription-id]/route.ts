import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { IcsSubscriptionRecord, EventRecord } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";

function subToData(record: any) {
  return {
    id: record.id,
    calendarId: record.data.calendarId,
    name: record.data.name,
    url: record.data.url,
    color: record.data.color || "#3B82F6",
    ownerId: record.data.ownerId,
    lastSynced: record.data.lastSynced || null,
    createdAt: record.data.createdAt,
  };
}

async function getSubscription(context: ApiContext, subscriptionId: string, calendarId: string) {
  const subRm = context.recordManager<IcsSubscriptionRecord>("calendars", "ics_subscription");
  const record = await subRm.readRecord(subscriptionId);
  if (!record || (record.data as any).calendarId !== calendarId) return null;
  return { record, subRm };
}

export async function PATCH(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string; subscriptionId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (!["owner", "admin", "editor"].includes(access.level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sub = await getSubscription(context, params.subscriptionId, params.calendarId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const updates: Partial<IcsSubscriptionRecord> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.color !== undefined) updates.color = body.color;

    const table = await sub.subRm.getTable();

    if (body.color !== undefined && body.color !== (sub.record.data as any).color) {
      const eventsRm = context.recordManager<EventRecord>("calendars", "event");
      const evTable = await eventsRm.getTable();
      const synced = await eventsRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 5000 });
      const toUpdate = synced.records.filter((r: any) => r.data.icsSubscriptionId === params.subscriptionId);
      for (const ev of toUpdate) {
        await eventsRm.updateRecord(evTable, ev.id, { color: body.color } as any);
      }
    }

    const updated = await sub.subRm.updateRecord(table, params.subscriptionId, updates as any);
    return NextResponse.json(subToData(updated));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string; subscriptionId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (!["owner", "admin"].includes(access.level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sub = await getSubscription(context, params.subscriptionId, params.calendarId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const eventsRm = context.recordManager<EventRecord>("calendars", "event");
    const synced = await eventsRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 5000 });
    const toDelete = synced.records.filter((r: any) => r.data.icsSubscriptionId === params.subscriptionId);
    if (toDelete.length > 0) {
      await eventsRm.bulkDeleteRecords(toDelete.map((r: any) => r.id));
    }
    await sub.subRm.deleteRecord(params.subscriptionId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
