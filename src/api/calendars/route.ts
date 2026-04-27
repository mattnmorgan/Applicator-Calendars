import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { v4 as uuidv4 } from "uuid";
import { CalendarRecord, CalendarRole } from "@/src/types";
import { listCalendarShares } from "@/src/lib/calendar-access";

function calendarToData(record: any, role: CalendarRole) {
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

export async function GET(_req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mgr = context.recordManager<CalendarRecord>("calendars", "calendar");
  const caManager = (context as any).contextualAuthorityManager;

  const owned = await mgr.readRecords({ fields: { ownerId: user.id }, limit: 500 });
  const ownedIds = new Set(owned.records.map((r: any) => r.id));

  const { records: allCAs } = await caManager.readRecords({ fields: { app: "calendars", user: user.id }, limit: 1000 });
  const sharedCalendars: any[] = [];

  for (const ca of allCAs) {
    // Key format: calendars:calendar-{calendarId}:user:{userId}
    const parts = (ca.id as string).split(":");
    if (parts.length < 3 || !parts[1].startsWith("calendar-")) continue;
    const calId = parts[1].slice("calendar-".length);
    if (ownedIds.has(calId)) continue;

    const cal = await mgr.readRecord(calId);
    if (!cal) continue;

    const ctx = ca.data.context ? JSON.parse(ca.data.context) : {};
    sharedCalendars.push(calendarToData(cal, ctx.role || "viewer"));
  }

  const calendars = [
    ...owned.records.map((r: any) => calendarToData(r, "owner")),
    ...sharedCalendars,
  ];

  return NextResponse.json({ calendars });
}

export async function POST(req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const mgr = context.recordManager<CalendarRecord>("calendars", "calendar");
    const table = await mgr.getTable();
    const now = new Date().toISOString();

    const record = await mgr.createRecord(table, {
      name: body.name.trim(),
      description: body.description?.trim() || "",
      color: body.color || "#3B82F6",
      hasIcon: false,
      defaultView: body.defaultView || "week",
      ownerId: user.id,
      icsToken: uuidv4(),
      createdAt: now,
      updatedAt: now,
    } as any);

    return NextResponse.json(calendarToData(record, "owner"), { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
