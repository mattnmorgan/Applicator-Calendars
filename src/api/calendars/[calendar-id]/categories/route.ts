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

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  const catRm = context.recordManager<CategoryRecord>("calendars", "category");
  const result = await catRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 500 });
  const categories = result.records.map(categoryToData);
  categories.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ categories });
}

export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const catRm = context.recordManager<CategoryRecord>("calendars", "category");
    const table = await catRm.getTable();
    const now = new Date().toISOString();

    const record = await catRm.createRecord(table, {
      calendarId: params.calendarId,
      name: body.name.trim(),
      color: body.color || "#3B82F6",
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
    } as any);

    return NextResponse.json(categoryToData(record), { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
