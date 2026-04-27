import { EventData } from "@/src/types";
import { expandEvent } from "@/src/lib/recurrence";

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function icsDate(isoStr: string, allDay: boolean): string {
  const d = new Date(isoStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (allDay) return `${y}${m}${day}`;
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function wrapLine(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  let result = line.substring(0, MAX);
  let pos = MAX;
  while (pos < line.length) {
    result += "\r\n " + line.substring(pos, pos + MAX - 1);
    pos += MAX - 1;
  }
  return result;
}

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
    lines.push(`DTSTART;VALUE=DATE:${icsDate(startDate, true)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(endDate, true)}`);
  } else {
    lines.push(`DTSTART:${icsDate(startDate, false)}`);
    lines.push(`DTEND:${icsDate(endDate, false)}`);
  }
  lines.push(wrapLine(`SUMMARY:${icsEscape(name)}`));
  if (description) lines.push(wrapLine(`DESCRIPTION:${icsEscape(description)}`));
  if (location) lines.push(wrapLine(`LOCATION:${icsEscape(location)}`));
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
    wrapLine(`X-WR-CALNAME:${icsEscape(calendarName)}`),
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
