import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { getCalendarAccess, createCalendarShare, listCalendarShares } from "@/src/lib/calendar-access";

async function enrichShare(context: ApiContext, ca: any) {
  const userMgr = context.recordManager("system", "users");
  const ctx = ca.data.context ? JSON.parse(ca.data.context) : {};
  try {
    const u = await userMgr.readRecord(ca.data.user) as any;
    return {
      id: ca.id,
      userId: ca.data.user,
      displayName: u?.data.display_name || u?.data.username || ca.data.user,
      username: u?.data.username || ca.data.user,
      profilePicture: u?.data.icon ? `/api/system/assets/icons/users/${ca.data.user}` : null,
      role: ctx.role as "viewer" | "editor" | "admin",
    };
  } catch {
    return {
      id: ca.id,
      userId: ca.data.user,
      displayName: ca.data.user,
      username: ca.data.user,
      profilePicture: null,
      role: ctx.role as "viewer" | "editor" | "admin",
    };
  }
}

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner" && access.level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cas = await listCalendarShares(context, params.calendarId);
  const shares = await Promise.all(cas.map((ca: any) => enrichShare(context, ca)));
  return NextResponse.json({ shares });
}

export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level !== "owner" && access.level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.userId || !body.role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
    }
    if (!["viewer", "editor", "admin"].includes(body.role)) {
      return NextResponse.json({ error: "role must be viewer, editor, or admin" }, { status: 400 });
    }
    if (body.userId === access.userId) {
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
    }
    if (body.userId === access.calendar.data.ownerId) {
      return NextResponse.json({ error: "Cannot share with the calendar owner" }, { status: 400 });
    }

    const existing = await listCalendarShares(context, params.calendarId);
    if (existing.find((ca: any) => ca.data.user === body.userId)) {
      return NextResponse.json({ error: "Already shared with this user" }, { status: 409 });
    }

    const ca = await createCalendarShare(context, params.calendarId, body.userId, body.role, access.userId);
    const enriched = await enrichShare(context, { ...ca, data: { ...ca.data, context: JSON.stringify({ role: body.role }) } });
    return NextResponse.json(enriched, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
