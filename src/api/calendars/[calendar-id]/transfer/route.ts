import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { CalendarRecord } from "@/src/types";
import { getCalendarAccess, listCalendarShares, deleteCalendarShare, createCalendarShare } from "@/src/lib/calendar-access";

export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner") return NextResponse.json({ error: "Only the owner can transfer ownership" }, { status: 403 });

  try {
    const body = await req.json();
    if (!body.newOwnerId) {
      return NextResponse.json({ error: "newOwnerId is required" }, { status: 400 });
    }
    if (body.newOwnerId === access.userId) {
      return NextResponse.json({ error: "You are already the owner" }, { status: 400 });
    }

    const mgr = context.recordManager<CalendarRecord>("calendars", "calendar");
    const table = await mgr.getTable();

    const cas = await listCalendarShares(context, params.calendarId);
    const newOwnerShare = cas.find((ca: any) => ca.data.user === body.newOwnerId);
    if (newOwnerShare) {
      await deleteCalendarShare(context, newOwnerShare.id);
    }

    await mgr.updateRecord(table, params.calendarId, {
      ownerId: body.newOwnerId,
      updatedAt: new Date().toISOString(),
    } as any);

    const currentOwnerShare = cas.find((ca: any) => ca.data.user === access.userId);
    if (currentOwnerShare) {
      await deleteCalendarShare(context, currentOwnerShare.id);
    }
    await createCalendarShare(context, params.calendarId, access.userId, "admin", body.newOwnerId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
