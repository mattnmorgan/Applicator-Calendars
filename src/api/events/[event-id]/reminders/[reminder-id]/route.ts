import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";

export async function DELETE(
  _req: NextRequest,
  context: ApiContext,
  params: { eventId: string; reminderId: string }
) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const remindersRm = context.recordManager("calendars", "reminder");
  const reminder = await remindersRm.readRecord(params.reminderId);
  if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((reminder.data as any).userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await remindersRm.deleteRecord(params.reminderId);
  return NextResponse.json({ success: true });
}
