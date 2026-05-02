import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { EventRecord, IcsSubscriptionRecord } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });

  try {
    const calData = access.calendar.data as any;

    const eventsRm = context.recordManager<EventRecord>("calendars", "event");
    const allEvents = await eventsRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 10000 });
    const events = allEvents.records
      .filter((r: any) => !r.data.icsSubscriptionId)
      .map((r: any) => ({
        name: r.data.name,
        description: r.data.description || "",
        location: r.data.location || "",
        color: r.data.color || "",
        allDay: !!r.data.allDay,
        status: r.data.status || "free",
        startDate: r.data.startDate,
        endDate: r.data.endDate,
        isRecurring: !!r.data.isRecurring,
        recurrenceRule: r.data.recurrenceRule || null,
        seriesId: r.data.seriesId || null,
        exceptionDate: r.data.exceptionDate || null,
        isException: !!r.data.isException,
        deletedOccurrences: r.data.deletedOccurrences || null,
      }));

    const subRm = context.recordManager<IcsSubscriptionRecord>("calendars", "ics_subscription");
    const allSubs = await subRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 200 });
    const subscriptions = allSubs.records.map((r: any) => ({
      name: r.data.name,
      url: r.data.url,
      color: r.data.color || "",
    }));

    let icon: string | null = null;
    if (calData.hasIcon) {
      try {
        const iconPath = `icons/calendars/${params.calendarId}.jpg`;
        const iconData = await context.appFileManager.readFile(iconPath);
        icon = iconData.toString("base64");
      } catch {
        icon = null;
      }
    }

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      calendar: {
        name: calData.name,
        description: calData.description || "",
        color: calData.color || "#3B82F6",
        defaultView: calData.defaultView || "week",
      },
      hasIcon: !!calData.hasIcon,
      icon,
      events,
      subscriptions,
    };

    const json = JSON.stringify(exportData, null, 2);
    const filename = `${(calData.name as string).replace(/[^a-z0-9]/gi, "_")}_export.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
