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

async function getTodoWithAccess(context: ApiContext, todoId: string) {
  const todosRm = context.recordManager<TodoRecord>("calendars", "todo");
  const record = await todosRm.readRecord(todoId);
  if (!record) return null;

  const access = await getCalendarAccess(context, (record.data as any).calendarId);
  if (!access) return null;

  return { record, access };
}

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { todoId: string }
) {
  const result = await getTodoWithAccess(context, params.todoId);
  if (!result) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  return NextResponse.json(parseTodoData(result.record));
}

export async function PATCH(
  req: NextRequest,
  context: ApiContext,
  params: { todoId: string }
) {
  const result = await getTodoWithAccess(context, params.todoId);
  if (!result) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (result.access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const todosRm = context.recordManager<TodoRecord>("calendars", "todo");
    const table = await todosRm.getTable();
    const now = new Date().toISOString();

    const updates: Partial<TodoRecord> & { updatedAt: string } = { updatedAt: now };
    if (body.summary !== undefined) updates.summary = body.summary.trim();
    if (body.description !== undefined) updates.description = body.description;
    if ("due" in body) updates.due = body.due || undefined;
    if (body.allDay !== undefined) updates.allDay = body.allDay;
    if (body.status !== undefined) updates.status = body.status;
    if ("priority" in body) updates.priority = body.priority != null ? body.priority : undefined;
    if ("completedAt" in body) updates.completedAt = body.completedAt || undefined;
    if ("categoryId" in body) (updates as any).categoryId = body.categoryId || null;

    const updated = await todosRm.updateRecord(table, params.todoId, updates as any);
    return NextResponse.json(parseTodoData(updated));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { todoId: string }
) {
  const result = await getTodoWithAccess(context, params.todoId);
  if (!result) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (result.access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const todosRm = context.recordManager<TodoRecord>("calendars", "todo");
    await todosRm.deleteRecord(params.todoId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
