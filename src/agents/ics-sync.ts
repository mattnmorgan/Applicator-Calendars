/**
 * ICS Sync Agent — runs every 30 minutes.
 * Fetches all ICS subscriptions, downloads each feed, replaces synced events.
 */

(async () => {
  const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  process.on("message", (msg: any) => {
    const { id, result, error } = msg;
    if (id && pending.has(id)) {
      const { resolve, reject } = pending.get(id)!;
      pending.delete(id);
      if (error) reject(new Error(error));
      else resolve(result);
    }
  });

  function sdk<T = any>(method: string, params: Record<string, any>): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      pending.set(id, { resolve, reject });
      process.send!({ id, method, params });
    });
  }

  // ─── Inline ICS parser ───────────────────────────────────────────────────────

  interface ParsedEvent {
    uid: string;
    summary: string;
    description?: string;
    location?: string;
    startDate: string;
    endDate: string;
    allDay: boolean;
    status: "free" | "busy" | "ooo";
  }

  function icsUnescape(s: string): string {
    return s.replace(/\\n/gi, "\n").replace(/\\;/g, ";").replace(/\\,/g, ",").replace(/\\\\/g, "\\");
  }

  function parseICSDate(val: string | undefined, allDay: boolean): string | null {
    if (!val) return null;
    try {
      if (allDay) return `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T00:00:00.000Z`;
      const y = val.slice(0, 4), mo = val.slice(4, 6), d = val.slice(6, 8);
      const h = val.slice(9, 11), mn = val.slice(11, 13), s = val.slice(13, 15);
      return new Date(`${y}-${mo}-${d}T${h}:${mn}:${s}Z`).toISOString();
    } catch { return null; }
  }

  function parseICS(content: string): ParsedEvent[] {
    const unfolded = content.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
    const lines = unfolded.split(/\r\n|\n|\r/);
    const events: ParsedEvent[] = [];
    let inVEvent = false;
    let props: Record<string, string> = {};
    let rawNames: Record<string, string> = {};

    for (const line of lines) {
      if (line === "BEGIN:VEVENT") {
        inVEvent = true; props = {}; rawNames = {};
      } else if (line === "END:VEVENT") {
        inVEvent = false;
        const uid = props["UID"];
        const summary = icsUnescape(props["SUMMARY"] || "");
        if (!uid || !summary) continue;
        const rawStart = rawNames["DTSTART"] || "";
        const allDay = rawStart.includes("VALUE=DATE") && !rawStart.includes("DATE-TIME");
        const start = parseICSDate(props["DTSTART"], allDay);
        const end = parseICSDate(props["DTEND"] || props["DTSTART"], allDay);
        if (!start || !end) continue;
        const transp = (props["TRANSP"] || "").toUpperCase();
        const msCdo = (props["X-MICROSOFT-CDO-BUSYSTATUS"] || "").toUpperCase();
        let status: "free" | "busy" | "ooo" = "free";
        if (transp === "OPAQUE") status = "busy";
        if (msCdo === "OOF") status = "ooo";
        events.push({
          uid, summary,
          description: props["DESCRIPTION"] ? icsUnescape(props["DESCRIPTION"]) : undefined,
          location: props["LOCATION"] ? icsUnescape(props["LOCATION"]) : undefined,
          startDate: start, endDate: end, allDay, status,
        });
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

  // ─── Main ────────────────────────────────────────────────────────────────────

  try {
    await sdk("logger.info", { message: "ICS sync agent starting" });

    const subsResult = await sdk<{ records: any[] }>("records.list", {
      table: "ics_subscription",
      limit: 1000,
    });

    if (subsResult.records.length === 0) {
      await sdk("logger.info", { message: "No ICS subscriptions to sync" });
      process.exit(0);
      return;
    }

    let synced = 0;
    let errors = 0;

    for (const sub of subsResult.records) {
      const { id, data } = sub;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        let icsContent: string;
        try {
          const res = await fetch(data.url, { signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          icsContent = await res.text();
        } catch (e) {
          clearTimeout(timeout);
          throw e;
        }

        const events = parseICS(icsContent);

        // Delete existing synced events for this subscription
        const existing = await sdk<{ records: any[] }>("records.list", {
          table: "event",
          filters: [{ field: "icsSubscriptionId", operator: "=", value: id }],
          limit: 5000,
        });
        for (const ev of existing.records) {
          await sdk("records.delete", { table: "event", id: ev.id });
        }

        // Insert new events
        const now = new Date().toISOString();
        for (const ev of events) {
          await sdk("records.create", {
            table: "event",
            data: {
              calendarId: data.calendarId,
              name: ev.summary,
              description: ev.description || "",
              location: ev.location || "",
              color: data.color || "#3B82F6",
              allDay: ev.allDay,
              status: ev.status,
              startDate: ev.startDate,
              endDate: ev.endDate,
              isRecurring: false,
              icsSubscriptionId: id,
              icsUid: ev.uid,
              createdBy: data.ownerId,
              createdAt: now,
              updatedAt: now,
            },
          });
        }

        await sdk("records.update", {
          table: "ics_subscription",
          id,
          data: { lastSynced: new Date().toISOString() },
        });

        await sdk("logger.info", { message: `Synced subscription "${data.name}": ${events.length} events` });
        synced++;
      } catch (err: any) {
        await sdk("logger.warn", { message: `Failed to sync subscription "${data.name}" (${id}): ${err.message}` });
        errors++;
      }
    }

    await sdk("logger.info", { message: `ICS sync complete — ${synced} synced, ${errors} errors` });
    process.exit(0);
  } catch (err: any) {
    try { await sdk("logger.error", { message: `ICS sync agent fatal: ${err.message}` }); } catch {}
    process.exit(1);
  }
})();
