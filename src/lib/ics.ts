import { ics } from "@applicator/sdk/utilities";
import { EventData } from "@/src/types";
import { expandEvent } from "@/src/lib/recurrence";

function icsTransp(status?: string): string {
  if (status === "busy") return "OPAQUE";
  if (status === "ooo") return "OPAQUE";
  return "TRANSPARENT";
}

function buildVEvent(
  uid: string,
  startDate: string,
  endDate: string,
  allDay: boolean,
  name: string,
  description?: string,
  location?: string,
  status?: string
): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${uid}@applicator`);
  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${ics.icsDate(startDate, true)}`);
    lines.push(`DTEND;VALUE=DATE:${ics.icsDate(endDate, true)}`);
  } else {
    lines.push(`DTSTART:${ics.icsDate(startDate, false)}`);
    lines.push(`DTEND:${ics.icsDate(endDate, false)}`);
  }
  lines.push(ics.icsFoldLine(`SUMMARY:${ics.icsEscape(name)}`));
  if (description) lines.push(ics.icsFoldLine(`DESCRIPTION:${ics.icsEscape(description)}`));
  if (location) lines.push(ics.icsFoldLine(`LOCATION:${ics.icsEscape(location)}`));
  lines.push(`TRANSP:${icsTransp(status)}`);
  lines.push("END:VEVENT");
  return lines;
}

export function generateICS(calendarName: string, events: EventData[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Applicator//Calendars//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ics.icsFoldLine(`X-WR-CALNAME:${ics.icsEscape(calendarName)}`),
  ];

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  for (const event of events) {
    if (!event.isRecurring) {
      lines.push(
        ...buildVEvent(
          event.id,
          event.startDate,
          event.endDate,
          event.allDay,
          event.name,
          event.description,
          event.location,
          event.status
        )
      );
    } else {
      const occurrences = expandEvent(event, rangeStart, rangeEnd);
      for (const occ of occurrences) {
        lines.push(
          ...buildVEvent(
            `${event.id}-${occ.occurrenceDate}`,
            occ.occurrenceStart,
            occ.occurrenceEnd,
            event.allDay,
            event.name,
            event.description,
            event.location,
            event.status
          )
        );
      }
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
