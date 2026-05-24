import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { TodoRecord, TodoData, TodoStatus } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";

function parseTodoData(record: any): TodoData {
  return {
    id: record.id,
    calendarId: record.data.calendarId,
    summary: record.data.summary,
    description: record.data.description || undefined,
    due: record.data.due || undefined,
    allDay: !!record.data.allDay,
    status: (record.data.status || "needs-action") as TodoStatus,
    priority: record.data.priority != null ? Number(record.data.priority) : undefined,
    completedAt: record.data.completedAt || undefined,
    color: record.data.color || undefined,
    categoryId: record.data.categoryId || null,
    icsCategory: record.data.icsCategory || undefined,
    icsSubscriptionId: record.data.icsSubscriptionId || null,
    createdBy: record.data.createdBy,
    createdAt: record.data.createdAt,
    updatedAt: record.data.updatedAt,
  };
}

export async function GET(req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const calIdsParam = url.searchParams.get("calendarIds") || "";
  const calIds = calIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (calIds.length === 0) return NextResponse.json({ todos: [] });

  const todosRm = context.recordManager<TodoRecord>("calendars", "todo");
  const allTodos: TodoData[] = [];

  for (const calId of calIds) {
    const access = await getCalendarAccess(context, calId);
    if (!access) continue;
    const result = await todosRm.readRecords({ fields: { calendarId: calId }, limit: 2000 });
    allTodos.push(...result.records.map(parseTodoData));
  }

  return NextResponse.json({ todos: allTodos });
}

export async function POST(req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.calendarId) return NextResponse.json({ error: "calendarId is required" }, { status: 400 });
    if (!body.summary?.trim()) return NextResponse.json({ error: "summary is required" }, { status: 400 });

    const access = await getCalendarAccess(context, body.calendarId);
    if (!access) return NextResponse.json({ error: "Calendar not found or access denied" }, { status: 404 });
    if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const todosRm = context.recordManager<TodoRecord>("calendars", "todo");
    const table = await todosRm.getTable();
    const now = new Date().toISOString();

    const record = await todosRm.createRecord(table, {
      calendarId: body.calendarId,
      summary: body.summary.trim(),
      description: body.description || "",
      due: body.due || null,
      allDay: body.due ? !!body.allDay : true,
      status: body.status || "needs-action",
      priority: body.priority != null ? body.priority : null,
      completedAt: body.completedAt || null,
      categoryId: body.categoryId || null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    } as any);

    return NextResponse.json(parseTodoData(record), { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
