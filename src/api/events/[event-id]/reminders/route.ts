import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { EventRecord } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { eventId: string }
) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventsRm = context.recordManager<EventRecord>("calendars", "event");
  const event = await eventsRm.readRecord(params.eventId);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getCalendarAccess(context, (event.data as any).calendarId);
  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const remindersRm = context.recordManager("calendars", "reminder");
  const result = await remindersRm.readRecords({
    fields: { eventId: params.eventId, userId: user.id },
    limit: 50,
  });

  const reminders = result.records.map((r: any) => ({
    id: r.id,
    eventId: r.data.eventId,
    userId: r.data.userId,
    minutesBefore: r.data.minutesBefore,
  }));

  return NextResponse.json({ reminders });
}

export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { eventId: string }
) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventsRm = context.recordManager<EventRecord>("calendars", "event");
  const event = await eventsRm.readRecord(params.eventId);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getCalendarAccess(context, (event.data as any).calendarId);
  if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    if (typeof body.minutesBefore !== "number" || body.minutesBefore < 0) {
      return NextResponse.json({ error: "minutesBefore must be a non-negative number" }, { status: 400 });
    }

    const remindersRm = context.recordManager("calendars", "reminder");
    const table = await remindersRm.getTable();
    const record = await remindersRm.createRecord(table, {
      eventId: params.eventId,
      userId: user.id,
      minutesBefore: body.minutesBefore,
      sentForDates: "[]",
    } as any);

    return NextResponse.json(
      { id: record.id, eventId: params.eventId, userId: user.id, minutesBefore: body.minutesBefore },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
