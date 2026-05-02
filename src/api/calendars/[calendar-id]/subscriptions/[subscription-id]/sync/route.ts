import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { IcsSubscriptionRecord } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";
import { syncICSSubscription } from "@/src/lib/ics-sync";

export async function POST(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string; subscriptionId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (!["owner", "admin", "editor"].includes(access.level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subRm = context.recordManager<IcsSubscriptionRecord>("calendars", "ics_subscription");
  const record = await subRm.readRecord(params.subscriptionId);
  if (!record || (record.data as any).calendarId !== params.calendarId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = record.data as any;
    const count = await syncICSSubscription(
      context,
      params.subscriptionId,
      params.calendarId,
      data.url,
      data.color || "#3B82F6",
      user.id
    );
    const table = await subRm.getTable();
    await subRm.updateRecord(table, params.subscriptionId, {
      lastSynced: new Date().toISOString(),
    } as any);
    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
