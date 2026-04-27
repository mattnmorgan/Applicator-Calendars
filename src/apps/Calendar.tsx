"use client";

import React from "react";
import { Spinner, ToastStack, ButtonIcon, Button, Icon, ConfirmModal } from "@applicator/sdk/components";
import { UiContext } from "@applicator/sdk/context";
import { datetime } from "@applicator/sdk/utilities";
import { CalendarData, EventOccurrence, ViewMode } from "@/src/types";
import CalendarSidebar from "@/src/components/CalendarSidebar";
import CalendarView from "@/src/components/CalendarView";
import EventPanel from "@/src/components/EventPanel";
import EventModal from "@/src/components/EventModal";
import CalendarSettingsModal from "@/src/components/CalendarSettingsModal";
import NewCalendarModal from "@/src/components/NewCalendarModal";

const { addDays, addMonths, getWeekStart } = datetime;

interface Props {
  context?: UiContext;
}

interface Toast { type: "success" | "error"; message: string; }

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
  // agenda: next 30 days
  return { start: base, end: addDays(base, 30) };
}

export default function Calendar({ context: _context }: Props) {
  const [calendars, setCalendars] = React.useState<CalendarData[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = React.useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = React.useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  });
  const [events, setEvents] = React.useState<EventOccurrence[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [lastRefreshed, setLastRefreshed] = React.useState<Date | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<EventOccurrence | null>(null);
  const [showEventModal, setShowEventModal] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<EventOccurrence | null>(null);
  const [showCalendarSettings, setShowCalendarSettings] = React.useState(false);
  const [showNewCalendar, setShowNewCalendar] = React.useState(false);
  const [confirmDeleteCalendar, setConfirmDeleteCalendar] = React.useState(false);

  const selectedCalendar = calendars.find((c) => c.id === selectedCalendarId);

  function addToast(type: Toast["type"], message: string) {
    setToasts((t) => [...t, { type, message }]);
  }

  async function loadCalendars() {
    try {
      const res = await fetch("/api/calendars/calendars");
      if (!res.ok) throw new Error("Failed to load calendars");
      const data = await res.json();
      const cals: CalendarData[] = data.calendars || [];
      setCalendars(cals);

      if (!selectedCalendarId && cals.length > 0) {
        const pref = await fetch("/api/calendars/preferences").then((r) => r.json()).catch(() => ({ defaultView: "" }));
        setSelectedCalendarId(cals[0].id);
        const view = pref.defaultView || cals[0].defaultView || "week";
        setViewMode(view as ViewMode);
      }
    } catch (e: any) {
      addToast("error", e.message);
    }
  }

  async function loadEvents() {
    if (!selectedCalendarId) { setEvents([]); return; }
    setEventsLoading(true);
    try {
      const { start, end } = getViewRange(viewMode, currentDate);
      const params = new URLSearchParams({
        calendarIds: selectedCalendarId,
        start: start.toISOString(),
        end: end.toISOString(),
      });
      const res = await fetch(`/api/calendars/events?${params}`);
      if (!res.ok) throw new Error("Failed to load events");
      const data = await res.json();
      setEvents(data.events || []);
      setLastRefreshed(new Date());
    } catch (e: any) {
      addToast("error", e.message);
    } finally {
      setEventsLoading(false);
    }
  }

  React.useEffect(() => {
    loadCalendars().finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    loadEvents();
  }, [selectedCalendarId, viewMode, currentDate]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      loadCalendars();
      loadEvents();
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [selectedCalendarId, viewMode, currentDate]);

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

  async function handleDeleteCalendar() {
    if (!selectedCalendarId) return;
    try {
      const res = await fetch(`/api/calendars/calendars/${selectedCalendarId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete");
      setCalendars((prev) => prev.filter((c) => c.id !== selectedCalendarId));
      setSelectedCalendarId(null);
      setEvents([]);
      addToast("success", "Calendar deleted");
    } catch (e: any) {
      addToast("error", e.message);
    }
  }

  async function handleDeleteEvent(scope: "one" | "following" | "all") {
    if (!selectedEvent) return;
    const params = new URLSearchParams({ scope });
    if (scope !== "all" && selectedEvent.isRecurring) {
      params.set("occurrenceDate", selectedEvent.occurrenceDate);
    }
    try {
      const res = await fetch(`/api/calendars/events/${selectedEvent.id}?${params}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete");
      setSelectedEvent(null);
      await loadEvents();
      addToast("success", "Event deleted");
    } catch (e: any) {
      addToast("error", e.message);
    }
  }

  async function handleNewCalendar(data: { name: string; description: string; color: string }) {
    const res = await fetch("/api/calendars/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to create");
    const cal = await res.json();
    setCalendars((prev) => [...prev, cal]);
    setSelectedCalendarId(cal.id);
    setShowNewCalendar(false);
    addToast("success", "Calendar created");
  }

  const canEdit = selectedCalendar ? ["owner", "admin", "editor"].includes(selectedCalendar.role) : false;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <ToastStack toasts={toasts} onClose={(i) => setToasts((t) => t.filter((_, idx) => idx !== i))} />

      <CalendarSidebar
        calendars={calendars}
        selectedCalendarId={selectedCalendarId}
        onSelectCalendar={(id) => { setSelectedCalendarId(id); setSelectedEvent(null); }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onNewCalendar={() => setShowNewCalendar(true)}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {selectedCalendar ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid #334155",
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  {selectedCalendar.hasIcon ? (
                    <img
                      src={`/api/calendars/icons/calendars/${selectedCalendar.id}`}
                      style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ width: 20, height: 20, borderRadius: 4, background: selectedCalendar.color || "#3B82F6", display: "inline-block", flexShrink: 0 }} />
                  )}
                  {selectedCalendar.name}
                  {selectedCalendar.role !== "owner" && (
                    <span style={{ fontSize: 11, background: "#334155", color: "#e2e8f0", padding: "1px 6px", borderRadius: 10, textTransform: "capitalize" }}>
                      {selectedCalendar.role}
                    </span>
                  )}
                </div>
                {selectedCalendar.description && (
                  <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>{selectedCalendar.description}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {canEdit && (
                  <ButtonIcon name="plus" label="New event" onClick={() => { setEditingEvent(null); setShowEventModal(true); }} size="sm" />
                )}
                <ButtonIcon name="settings" label="Calendar settings" onClick={() => setShowCalendarSettings(true)} size="sm" />
                {selectedCalendar.role === "owner" && (
                  <ButtonIcon name="trash" label="Delete calendar" onClick={() => setConfirmDeleteCalendar(true)} size="sm" subvariant="danger" />
                )}
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
              <CalendarView
                viewMode={viewMode}
                currentDate={currentDate}
                events={events}
                calendars={calendars}
                onEventClick={(ev) => setSelectedEvent(ev)}
                onNavigate={handleNavigate as any}
                lastRefreshed={lastRefreshed}
                onRefresh={() => { loadCalendars(); loadEvents(); }}
                refreshing={eventsLoading}
              />
              {selectedEvent && (
                <EventPanel
                  event={selectedEvent}
                  calendar={calendars.find((c) => c.id === selectedEvent.calendarId)}
                  onClose={() => setSelectedEvent(null)}
                  onEdit={() => { setEditingEvent(selectedEvent); setShowEventModal(true); }}
                  onDelete={handleDeleteEvent}
                  canEdit={canEdit}
                />
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              opacity: 0.6,
            }}
          >
            <span><Icon name="calendar" size={48} /></span>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No calendar selected</div>
            <div style={{ fontSize: 14 }}>
              {calendars.length === 0 ? (
                <Button variant="primary" onClick={() => setShowNewCalendar(true)}>Create your first calendar</Button>
              ) : (
                "Select a calendar from the sidebar"
              )}
            </div>
          </div>
        )}
      </div>

      {showNewCalendar && (
        <NewCalendarModal onClose={() => setShowNewCalendar(false)} onCreate={handleNewCalendar} />
      )}

      {showCalendarSettings && selectedCalendar && (
        <CalendarSettingsModal
          calendar={selectedCalendar}
          onClose={() => setShowCalendarSettings(false)}
          onSaved={(updates) => {
            setCalendars((prev) => prev.map((c) => c.id === selectedCalendar.id ? { ...c, ...updates } : c));
            setShowCalendarSettings(false);
          }}
        />
      )}

      {showEventModal && selectedCalendar && (
        <EventModal
          calendarId={selectedCalendar.id}
          event={editingEvent}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
          onSaved={async () => {
            setShowEventModal(false);
            setEditingEvent(null);
            setSelectedEvent(null);
            await loadEvents();
            addToast("success", editingEvent ? "Event updated" : "Event created");
          }}
        />
      )}

      {confirmDeleteCalendar && (
        <ConfirmModal
          title="Delete calendar?"
          message={`"${selectedCalendar?.name}" and all its events will be permanently deleted. All shared access will be revoked.`}
          confirmText="Delete"
          danger
          onConfirm={() => { setConfirmDeleteCalendar(false); handleDeleteCalendar(); }}
          onCancel={() => setConfirmDeleteCalendar(false)}
        />
      )}
    </div>
  );
}
