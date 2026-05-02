import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { IcsSubscriptionRecord } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";
import { syncICSSubscription } from "@/src/lib/ics-sync";

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

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  const subRm = context.recordManager<IcsSubscriptionRecord>("calendars", "ics_subscription");
  const result = await subRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 200 });

  return NextResponse.json({ subscriptions: result.records.map(subToData) });
}

export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (!["owner", "admin", "editor"].includes(access.level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.url?.trim()) return NextResponse.json({ error: "URL is required" }, { status: 400 });
    if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const now = new Date().toISOString();
    const color = body.color || (access.calendar.data as any).color || "#3B82F6";

    const subRm = context.recordManager<IcsSubscriptionRecord>("calendars", "ics_subscription");
    const table = await subRm.getTable();

    const record = await subRm.createRecord(table, {
      calendarId: params.calendarId,
      name: body.name.trim(),
      url: body.url.trim(),
      color,
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
    } as any);

    try {
      await syncICSSubscription(context, record.id, params.calendarId, body.url.trim(), color, user.id);
      await subRm.updateRecord(table, record.id, { lastSynced: new Date().toISOString() } as any);
      const updated = await subRm.readRecord(record.id);
      return NextResponse.json(subToData(updated), { status: 201 });
    } catch (syncErr: any) {
      return NextResponse.json({ ...subToData(record), syncError: syncErr.message }, { status: 201 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
