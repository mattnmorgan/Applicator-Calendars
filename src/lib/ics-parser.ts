import { ics } from "@applicator/sdk/utilities";
import { TodoStatus } from "@/src/types";

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

export interface ParsedICSTodo {
  uid: string;
  summary: string;
  description?: string;
  due?: string;
  allDay?: boolean;
  status: TodoStatus;
  priority?: number;
  completedAt?: string;
  icsCategory?: string;
}

export function parseICS(content: string): { events: ParsedICSEvent[]; todos: ParsedICSTodo[] } {
  const unfolded = content.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r\n|\n|\r/);
  const events: ParsedICSEvent[] = [];
  const todos: ParsedICSTodo[] = [];
  let mode: "none" | "vevent" | "vtodo" = "none";
  let props: Record<string, string> = {};
  let rawNames: Record<string, string> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      mode = "vevent";
      props = {};
      rawNames = {};
    } else if (line === "BEGIN:VTODO") {
      mode = "vtodo";
      props = {};
      rawNames = {};
    } else if (line === "END:VEVENT") {
      mode = "none";
      const ev = buildEvent(props, rawNames);
      if (ev) events.push(ev);
    } else if (line === "END:VTODO") {
      mode = "none";
      const todo = buildTodo(props, rawNames);
      if (todo) todos.push(todo);
    } else if (mode !== "none") {
      const ci = line.indexOf(":");
      if (ci < 0) continue;
      const namePart = line.substring(0, ci);
      const val = line.substring(ci + 1);
      const base = namePart.split(";")[0].toUpperCase();
      props[base] = val;
      rawNames[base] = namePart.toUpperCase();
    }
  }

  return { events, todos };
}

function buildEvent(
  props: Record<string, string>,
  rawNames: Record<string, string>
): ParsedICSEvent | null {
  const uid = props["UID"];
  const summary = ics.icsUnescape(props["SUMMARY"] || "");
  if (!uid || !summary) return null;

  const rawStart = rawNames["DTSTART"] || "";
  const allDay = rawStart.includes("VALUE=DATE") && !rawStart.includes("DATE-TIME");

  const start = ics.parseICSDate(props["DTSTART"], allDay);
  const end = ics.parseICSDate(props["DTEND"] || props["DTSTART"], allDay);
  if (!start || !end) return null;

  const transp = (props["TRANSP"] || "").toUpperCase();
  const msCdo = (props["X-MICROSOFT-CDO-BUSYSTATUS"] || "").toUpperCase();
  let status: "free" | "busy" | "ooo" = "free";
  if (transp === "OPAQUE") status = "busy";
  if (msCdo === "OOF") status = "ooo";

  return {
    uid,
    summary,
    description: props["DESCRIPTION"] ? ics.icsUnescape(props["DESCRIPTION"]) : undefined,
    location: props["LOCATION"] ? ics.icsUnescape(props["LOCATION"]) : undefined,
    startDate: start,
    endDate: end,
    allDay,
    status,
  };
}

function buildTodo(
  props: Record<string, string>,
  rawNames: Record<string, string>
): ParsedICSTodo | null {
  const uid = props["UID"];
  const summary = ics.icsUnescape(props["SUMMARY"] || "");
  if (!uid || !summary) return null;

  const rawDue = rawNames["DUE"] || "";
  const allDay = rawDue.includes("VALUE=DATE") && !rawDue.includes("DATE-TIME");
  const due = props["DUE"] ? ics.parseICSDate(props["DUE"], allDay) ?? undefined : undefined;

  const rawStatus = (props["STATUS"] || "").toUpperCase();
  let status: TodoStatus = "needs-action";
  if (rawStatus === "IN-PROCESS") status = "in-process";
  else if (rawStatus === "COMPLETED") status = "completed";
  else if (rawStatus === "CANCELLED") status = "cancelled";

  const priorityRaw = props["PRIORITY"] ? parseInt(props["PRIORITY"], 10) : undefined;
  const priority = priorityRaw !== undefined && !isNaN(priorityRaw) && priorityRaw >= 1 && priorityRaw <= 9 ? priorityRaw : undefined;

  const completedAt = props["COMPLETED"] ? ics.parseICSDate(props["COMPLETED"], false) ?? undefined : undefined;

  const icsCategory = props["CATEGORIES"] ? ics.icsUnescape(props["CATEGORIES"]) : undefined;

  return {
    uid,
    summary,
    description: props["DESCRIPTION"] ? ics.icsUnescape(props["DESCRIPTION"]) : undefined,
    due,
    allDay: due ? allDay : undefined,
    status,
    priority,
    completedAt,
    icsCategory,
  };
}
