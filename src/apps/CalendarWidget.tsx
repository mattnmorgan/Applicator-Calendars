"use client";

import React from "react";
import { Spinner, Icon } from "@applicator/sdk/components";
import { UiContext } from "@applicator/sdk/context";
import { datetime } from "@applicator/sdk/utilities";
import { CalendarData, EventOccurrence, ViewMode } from "@/src/types";
import CalendarView from "@/src/components/CalendarView";
import EventPanel from "@/src/components/EventPanel";

const { addDays, addMonths, getWeekStart } = datetime;

interface Props {
  context?: UiContext;
  settings?: {
    calendarIds?: string;
    viewType?: string;
  };
}

function getViewRange(viewMode: ViewMode, currentDate: Date): { start: Date; end: Date } {
  const base = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));
  if (viewMode === "today") return { start: base, end: addDays(base, 1) };
  if (viewMode === "3days") return { start: base, end: addDays(base, 3) };
  if (viewMode === "week") {
    const ws = getWeekStart(base);
    return { start: ws, end: addDays(ws, 7) };
  }
  if (viewMode === "month") {
    const ms = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1));
    const me = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0));
    return { start: addDays(ms, -7), end: addDays(me, 7) };
  }
  return { start: base, end: addDays(base, 30) };
}

export default function CalendarWidget({ context: _context, settings }: Props) {
  const calendarIds = (settings?.calendarIds || "").split(",").map((s) => s.trim()).filter(Boolean);
  const viewType = (settings?.viewType || "week") as ViewMode;

  const [calendars, setCalendars] = React.useState<CalendarData[]>([]);
  const [events, setEvents] = React.useState<EventOccurrence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<ViewMode>(viewType);
  const [currentDate, setCurrentDate] = React.useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  });
  const [lastRefreshed, setLastRefreshed] = React.useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<EventOccurrence | null>(null);

  async function loadData() {
    if (calendarIds.length === 0) { setLoading(false); return; }

    try {
      const [calsRes, { start, end }] = [
        await fetch("/api/calendars/calendars"),
        getViewRange(viewMode, currentDate),
      ];
      const calsData = await calsRes.json();
      const allCals: CalendarData[] = calsData.calendars || [];
      const filtered = allCals.filter((c) => calendarIds.includes(c.id));
      setCalendars(filtered);

      if (filtered.length > 0) {
        const params = new URLSearchParams({
          calendarIds: filtered.map((c) => c.id).join(","),
          start: start.toISOString(),
          end: end.toISOString(),
        });
        const evRes = await fetch(`/api/calendars/events?${params}`);
        const evData = await evRes.json();
        setEvents(evData.events || []);
        setLastRefreshed(new Date());
      }
    } catch {
      // silently fail in widget context
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadData();
  }, [viewMode, currentDate]);

  React.useEffect(() => {
    const timer = setInterval(() => loadData(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [viewMode, currentDate]);

  function handleNavigate(direction: "prev" | "next" | "today" | ViewMode) {
    if (direction === "today") {
      const now = new Date();
      setCurrentDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
      return;
    }
    if (["today", "3days", "week", "month", "agenda"].includes(direction)) {
      setViewMode(direction as ViewMode);
      return;
    }
    const delta = direction === "prev" ? -1 : 1;
    setCurrentDate((prev) => {
      if (viewMode === "today") return addDays(prev, delta);
      if (viewMode === "3days") return addDays(prev, 3 * delta);
      if (viewMode === "week") return addDays(prev, 7 * delta);
      if (viewMode === "month") return addMonths(prev, delta);
      if (viewMode === "agenda") return addDays(prev, 30 * delta);
      return prev;
    });
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 120 }}>
        <Spinner />
      </div>
    );
  }

  if (calendarIds.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 120, opacity: 0.5, flexDirection: "column", gap: 8 }}>
        <Icon name="calendar" size={32} />
        <div style={{ fontSize: 13 }}>No calendars configured</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", position: "relative", color: "#e2e8f0" }}>
      <CalendarView
        viewMode={viewMode}
        currentDate={currentDate}
        events={events}
        calendars={calendars}
        onEventClick={(ev) => setSelectedEvent(ev)}
        onNavigate={handleNavigate as any}
        lastRefreshed={lastRefreshed}
        onRefresh={loadData}
      />
      {selectedEvent && (
        <>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 10 }}
            onClick={() => setSelectedEvent(null)}
          />
          <EventPanel
            event={selectedEvent}
            calendar={calendars.find((c) => c.id === selectedEvent.calendarId)}
            onClose={() => setSelectedEvent(null)}
            onEdit={() => {}}
            onDelete={() => {}}
            canEdit={false}
          />
        </>
      )}
    </div>
  );
}
