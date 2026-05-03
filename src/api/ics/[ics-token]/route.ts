import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { CalendarRecord, EventRecord, EventData } from "@/src/types";
import { generateICS } from "@/src/lib/ics";

function parseEventData(record: any): EventData {
  return {
    id: record.id,
    calendarId: record.data.calendarId,
    name: record.data.name,
    description: record.data.description,
    location: record.data.location,
    color: record.data.color,
    allDay: !!record.data.allDay,
    status: record.data.status || "free",
    startDate: record.data.startDate,
    endDate: record.data.endDate,
    isRecurring: !!record.data.isRecurring,
    recurrenceRule: record.data.recurrenceRule ? JSON.parse(record.data.recurrenceRule) : undefined,
    seriesId: record.data.seriesId,
    exceptionDate: record.data.exceptionDate,
    isException: !!record.data.isException,
    deletedOccurrences: record.data.deletedOccurrences ? JSON.parse(record.data.deletedOccurrences) : [],
    createdBy: record.data.createdBy,
    createdAt: record.data.createdAt,
    updatedAt: record.data.updatedAt,
  };
}

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { icsToken: string }
) {
  const calRm = context.recordManager<CalendarRecord>("calendars", "calendar");
  const result = await calRm.readRecords({ fields: { icsToken: params.icsToken }, limit: 1 });
  const cal = result.records[0];
  if (!cal || !cal.data.icsSharing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const eventsRm = context.recordManager<EventRecord>("calendars", "event");
  const evResult = await eventsRm.readRecords({ fields: { calendarId: cal.id }, limit: 5000 });
  const events = evResult.records.map(parseEventData);

  const ics = generateICS(cal.data.name, events);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(cal.data.name)}.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
