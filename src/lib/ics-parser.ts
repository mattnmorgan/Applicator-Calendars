export interface ParsedICSEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  status: "free" | "busy" | "ooo";
}

export function parseICS(content: string): ParsedICSEvent[] {
  const unfolded = content.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r\n|\n|\r/);
  const events: ParsedICSEvent[] = [];
  let inVEvent = false;
  let props: Record<string, string> = {};
  let rawNames: Record<string, string> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inVEvent = true;
      props = {};
      rawNames = {};
    } else if (line === "END:VEVENT") {
      inVEvent = false;
      const ev = buildEvent(props, rawNames);
      if (ev) events.push(ev);
    } else if (inVEvent) {
      const ci = line.indexOf(":");
      if (ci < 0) continue;
      const namePart = line.substring(0, ci);
      const val = line.substring(ci + 1);
      const base = namePart.split(";")[0].toUpperCase();
      props[base] = val;
      rawNames[base] = namePart.toUpperCase();
    }
  }

  return events;
}

function buildEvent(
  props: Record<string, string>,
  rawNames: Record<string, string>
): ParsedICSEvent | null {
  const uid = props["UID"];
  const summary = icsUnescape(props["SUMMARY"] || "");
  if (!uid || !summary) return null;

  const rawStart = rawNames["DTSTART"] || "";
  const allDay = rawStart.includes("VALUE=DATE") && !rawStart.includes("DATE-TIME");

  const start = parseICSDate(props["DTSTART"], allDay);
  const end = parseICSDate(props["DTEND"] || props["DTSTART"], allDay);
  if (!start || !end) return null;

  const transp = (props["TRANSP"] || "").toUpperCase();
  const msCdo = (props["X-MICROSOFT-CDO-BUSYSTATUS"] || "").toUpperCase();
  let status: "free" | "busy" | "ooo" = "free";
  if (transp === "OPAQUE") status = "busy";
  if (msCdo === "OOF") status = "ooo";

  return {
    uid,
    summary,
    description: props["DESCRIPTION"] ? icsUnescape(props["DESCRIPTION"]) : undefined,
    location: props["LOCATION"] ? icsUnescape(props["LOCATION"]) : undefined,
    startDate: start,
    endDate: end,
    allDay,
    status,
  };
}

function parseICSDate(val: string | undefined, allDay: boolean): string | null {
  if (!val) return null;
  try {
    if (allDay) {
      return `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T00:00:00.000Z`;
    }
    const y = val.slice(0, 4), mo = val.slice(4, 6), d = val.slice(6, 8);
    const h = val.slice(9, 11), mn = val.slice(11, 13), s = val.slice(13, 15);
    return new Date(`${y}-${mo}-${d}T${h}:${mn}:${s}Z`).toISOString();
  } catch {
    return null;
  }
}

function icsUnescape(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\;/g, ";")
    .replace(/\\,/g, ",")
    .replace(/\\\\/g, "\\");
}
