import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { getCalendarAccess, updateCalendarShare, deleteCalendarShare, listCalendarShares } from "@/src/lib/calendar-access";

export async function PATCH(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string; shareId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner" && access.level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.role || !["viewer", "editor", "admin"].includes(body.role)) {
      return NextResponse.json({ error: "role must be viewer, editor, or admin" }, { status: 400 });
    }

    const cas = await listCalendarShares(context, params.calendarId);
    const existing = cas.find((ca: any) => ca.id === params.shareId);
    if (!existing) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    await updateCalendarShare(
      context,
      params.shareId,
      params.calendarId,
      existing.data.user,
      body.role,
      access.userId
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string; shareId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner" && access.level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteCalendarShare(context, params.shareId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
