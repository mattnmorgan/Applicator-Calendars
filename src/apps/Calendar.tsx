"use client";

import React from "react";
import {
  Spinner,
  ToastStack,
  Button,
  Icon,
} from "@applicator/sdk/components";
import { UiContext } from "@applicator/sdk/context";
import { datetime } from "@applicator/sdk/utilities";
import { CalendarData, CategoryData, IcsSubscriptionData, EventOccurrence, ViewMode, TodoData } from "@/src/types";
import CalendarSidebar from "@/src/components/CalendarSidebar";
import CalendarView from "@/src/components/CalendarView";
import EventPanel from "@/src/components/EventPanel";
import EventModal from "@/src/components/EventModal";
import TodoPanel from "@/src/components/TodoPanel";
import TodoModal from "@/src/components/TodoModal";
import CalendarSettingsModal from "@/src/components/CalendarSettingsModal";
import NewCalendarModal from "@/src/components/NewCalendarModal";

const { addDays, addMonths, getWeekStart } = datetime;

interface Props {
  context?: UiContext;
}

interface Toast {
  type: "success" | "error";
  message: string;
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

export default function Calendar({ context: _context }: Props) {
  const [calendars, setCalendars] = React.useState<CalendarData[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = React.useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = React.useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  });
  const [events, setEvents] = React.useState<EventOccurrence[]>([]);
  const [todos, setTodos] = React.useState<TodoData[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [lastRefreshed, setLastRefreshed] = React.useState<Date | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<EventOccurrence | null>(null);
  const [selectedTodo, setSelectedTodo] = React.useState<TodoData | null>(null);
  const [showEventModal, setShowEventModal] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<EventOccurrence | null>(null);
  const [showTodoModal, setShowTodoModal] = React.useState(false);
  const [editingTodo, setEditingTodo] = React.useState<TodoData | null>(null);
  const [showCalendarSettings, setShowCalendarSettings] = React.useState(false);
  const [showNewCalendar, setShowNewCalendar] = React.useState(false);

  const [categories, setCategories] = React.useState<CategoryData[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<IcsSubscriptionData[]>([]);
  const [checkedCategoryIds, setCheckedCategoryIds] = React.useState<Set<string>>(new Set());
  const [checkedSubIds, setCheckedSubIds] = React.useState<Set<string>>(new Set());

  const selectedCalendar = calendars.find((c) => c.id === selectedCalendarId);
  const canEdit = selectedCalendar ? ["owner", "admin", "editor"].includes(selectedCalendar.role) : false;

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
        setViewMode((pref.defaultView || cals[0].defaultView || "week") as ViewMode);
      }
    } catch (e: any) {
      addToast("error", e.message);
    }
  }

  async function loadCategoriesAndSubs(calId: string) {
    try {
      const [catRes, subRes] = await Promise.all([
        fetch(`/api/calendars/calendars/${calId}/categories`),
        fetch(`/api/calendars/calendars/${calId}/subscriptions`),
      ]);
      const cats: CategoryData[] = catRes.ok ? (await catRes.json()).categories || [] : [];
      const subs: IcsSubscriptionData[] = subRes.ok ? (await subRes.json()).subscriptions || [] : [];
      setCategories(cats);
      setSubscriptions(subs);
      setCheckedCategoryIds(new Set(cats.map((c) => c.id)));
      setCheckedSubIds(new Set(subs.map((s) => s.id)));
    } catch { /* non-fatal */ }
  }

  async function loadEvents() {
    if (!selectedCalendarId) { setEvents([]); setTodos([]); return; }
    setEventsLoading(true);
    try {
      const { start, end } = getViewRange(viewMode, currentDate);
      const params = new URLSearchParams({ calendarIds: selectedCalendarId, start: start.toISOString(), end: end.toISOString() });
      const [evRes, todoRes] = await Promise.all([
        fetch(`/api/calendars/events?${params}`),
        fetch(`/api/calendars/todos?calendarIds=${selectedCalendarId}`),
      ]);
      if (!evRes.ok) throw new Error("Failed to load events");
      setEvents((await evRes.json()).events || []);
      setTodos(todoRes.ok ? (await todoRes.json()).todos || [] : []);
      setLastRefreshed(new Date());
    } catch (e: any) {
      addToast("error", e.message);
    } finally {
      setEventsLoading(false);
    }
  }

  React.useEffect(() => { loadCalendars().finally(() => setLoading(false)); }, []);
  React.useEffect(() => {
    if (selectedCalendarId) { loadCategoriesAndSubs(selectedCalendarId); }
    else { setCategories([]); setSubscriptions([]); setCheckedCategoryIds(new Set()); setCheckedSubIds(new Set()); }
  }, [selectedCalendarId]);
  React.useEffect(() => { loadEvents(); }, [selectedCalendarId, viewMode, currentDate]);
  React.useEffect(() => {
    const timer = setInterval(() => { loadCalendars(); loadEvents(); }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [selectedCalendarId, viewMode, currentDate]);

  const filteredEvents = React.useMemo(() => {
    return events.filter((ev) => {
      if (ev.icsSubscriptionId) return checkedSubIds.has(ev.icsSubscriptionId);
      if (ev.categoryId) return checkedCategoryIds.has(ev.categoryId);
      return true;
    });
  }, [events, checkedCategoryIds, checkedSubIds]);

  const filteredTodos = React.useMemo(() => {
    return todos.filter((todo) => {
      if (todo.icsSubscriptionId) return checkedSubIds.has(todo.icsSubscriptionId);
      if (todo.categoryId) return checkedCategoryIds.has(todo.categoryId);
      return true;
    });
  }, [todos, checkedCategoryIds, checkedSubIds]);

  function handleNavigate(direction: "prev" | "next" | "today" | ViewMode) {
    if (direction === "today") {
      const now = new Date();
      setCurrentDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
      return;
    }
    if (["today", "3days", "week", "month", "agenda"].includes(direction)) { setViewMode(direction as ViewMode); return; }
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

  function handleDeleteCalendar() {
    setCalendars((prev) => prev.filter((c) => c.id !== selectedCalendarId));
    setSelectedCalendarId(null);
    setEvents([]);
    setShowCalendarSettings(false);
    addToast("success", "Calendar deleted");
  }

  async function handleDeleteTodo() {
    if (!selectedTodo) return;
    try {
      const res = await fetch(`/api/calendars/todos/${selectedTodo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete");
      setSelectedTodo(null);
      await loadEvents();
      addToast("success", "Task deleted");
    } catch (e: any) {
      addToast("error", e.message);
    }
  }

  async function handleToggleTodoComplete() {
    if (!selectedTodo) return;
    const isCompleted = selectedTodo.status === "completed";
    const newStatus = isCompleted ? "needs-action" : "completed";
    try {
      const body: any = { status: newStatus };
      if (!isCompleted) body.completedAt = new Date().toISOString();
      else body.completedAt = null;
      const res = await fetch(`/api/calendars/todos/${selectedTodo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update");
      const updated: TodoData = await res.json();
      setSelectedTodo(updated);
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e: any) {
      addToast("error", e.message);
    }
  }

  async function handleDeleteEvent(scope: "one" | "following" | "all") {
    if (!selectedEvent) return;
    const params = new URLSearchParams({ scope });
    if (scope !== "all" && selectedEvent.isRecurring) params.set("occurrenceDate", selectedEvent.occurrenceDate);
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

  async function handleImportCalendar(
    calData: { name: string; description: string; color: string },
    payload: { events: any[]; categories: any[]; subscriptions: any[] }
  ) {
    const createRes = await fetch("/api/calendars/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calData),
    });
    if (!createRes.ok) throw new Error((await createRes.json()).error || "Failed to create calendar");
    const cal = await createRes.json();

    const importRes = await fetch(`/api/calendars/calendars/${cal.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!importRes.ok) throw new Error((await importRes.json()).error || "Failed to import");
    const result = await importRes.json();

    setCalendars((prev) => [...prev, cal]);
    setSelectedCalendarId(cal.id);
    setShowNewCalendar(false);
    addToast("success", `Imported: ${result.eventsImported} events, ${result.categoriesImported} categories`);
  }

  function handleCategoryCreated(cat: CategoryData) {
    setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
    setCheckedCategoryIds((prev) => new Set([...prev, cat.id]));
  }

  function handleCategoryUpdated(cat: CategoryData) {
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)).sort((a, b) => a.name.localeCompare(b.name)));
    loadEvents();
  }

  async function handleCategoryDeleted(id: string, scope: "migrate" | "delete") {
    try {
      const res = await fetch(`/api/calendars/calendars/${selectedCalendarId}/categories/${id}?scope=${scope}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete category");
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setCheckedCategoryIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      await loadEvents();
      addToast("success", "Category deleted");
    } catch (e: any) {
      addToast("error", e.message);
    }
  }

  function handleUnsubscribed(id: string) {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    setCheckedSubIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    loadEvents();
  }

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><Spinner /></div>;
  }

  if (showCalendarSettings && selectedCalendar) {
    return (
      <div style={{ display: "flex", height: "100%", overflow: "hidden", color: "white" }}>
        <ToastStack toasts={toasts} onClose={(i) => setToasts((t) => t.filter((_, idx) => idx !== i))} />
        <CalendarSettingsModal
          calendar={selectedCalendar}
          onClose={() => setShowCalendarSettings(false)}
          onSaved={(updates) => {
            setCalendars((prev) => prev.map((c) => (c.id === selectedCalendar.id ? { ...c, ...updates } : c)));
            if (selectedCalendarId) loadCategoriesAndSubs(selectedCalendarId);
            setShowCalendarSettings(false);
          }}
          onDelete={handleDeleteCalendar}
          onSubscriptionsChanged={() => {
            if (selectedCalendarId) loadCategoriesAndSubs(selectedCalendarId);
            loadEvents();
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", color: "white" }}>
      <ToastStack toasts={toasts} onClose={(i) => setToasts((t) => t.filter((_, idx) => idx !== i))} />

      <CalendarSidebar
        calendars={calendars}
        selectedCalendarId={selectedCalendarId}
        onSelectCalendar={(id) => { setSelectedCalendarId(id); setSelectedEvent(null); }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onNewCalendar={() => setShowNewCalendar(true)}
        categories={categories}
        subscriptions={subscriptions}
        checkedCategoryIds={checkedCategoryIds}
        checkedSubIds={checkedSubIds}
        onToggleCategory={(id) => setCheckedCategoryIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; })}
        onToggleSub={(id) => setCheckedSubIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; })}
        onCategoryCreated={handleCategoryCreated}
        onCategoryUpdated={handleCategoryUpdated}
        onCategoryDeleted={handleCategoryDeleted}
        onUnsubscribed={handleUnsubscribed}
        onSubscriptionSynced={loadEvents}
        canEdit={canEdit}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {selectedCalendar ? (
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, position: "relative" }}>
            <CalendarView
              viewMode={viewMode}
              currentDate={currentDate}
              events={filteredEvents}
              todos={filteredTodos}
              calendars={calendars}
              categories={categories}
              onEventClick={(ev) => { setSelectedTodo(null); setSelectedEvent(ev); }}
              onTodoClick={(todo) => { setSelectedEvent(null); setSelectedTodo(todo); }}
              onNavigate={handleNavigate as any}
              lastRefreshed={lastRefreshed}
              onRefresh={() => { loadCalendars(); loadEvents(); }}
              refreshing={eventsLoading}
              onNewEvent={canEdit ? () => { setEditingEvent(null); setShowEventModal(true); } : undefined}
              onNewTodo={canEdit ? () => { setEditingTodo(null); setShowTodoModal(true); } : undefined}
              onSettings={() => setShowCalendarSettings(true)}
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
                  category={categories.find((c) => c.id === selectedEvent.categoryId) || null}
                  onClose={() => setSelectedEvent(null)}
                  onEdit={() => { setEditingEvent(selectedEvent); setShowEventModal(true); }}
                  onDelete={handleDeleteEvent}
                  canEdit={canEdit}
                />
              </>
            )}
            {selectedTodo && (
              <>
                <div
                  style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 10 }}
                  onClick={() => setSelectedTodo(null)}
                />
                <TodoPanel
                  todo={selectedTodo}
                  calendar={calendars.find((c) => c.id === selectedTodo.calendarId)}
                  category={categories.find((c) => c.id === selectedTodo.categoryId) || null}
                  onClose={() => setSelectedTodo(null)}
                  onEdit={() => { setEditingTodo(selectedTodo); setShowTodoModal(true); }}
                  onDelete={handleDeleteTodo}
                  onToggleComplete={handleToggleTodoComplete}
                  canEdit={canEdit}
                />
              </>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, opacity: 0.6 }}>
            <span><Icon name="calendar" size={48} /></span>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>No calendar selected</div>
            <div style={{ fontSize: 14, color: "#e2e8f0" }}>
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
        <NewCalendarModal onClose={() => setShowNewCalendar(false)} onCreate={handleNewCalendar} onImport={handleImportCalendar} />
      )}

      {showEventModal && selectedCalendar && (
        <EventModal
          calendarId={selectedCalendar.id}
          calendarColor={selectedCalendar.color || "#3B82F6"}
          categories={categories}
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

      {showTodoModal && selectedCalendar && (
        <TodoModal
          calendarId={selectedCalendar.id}
          categories={categories}
          todo={editingTodo}
          onClose={() => { setShowTodoModal(false); setEditingTodo(null); }}
          onSaved={async () => {
            setShowTodoModal(false);
            setEditingTodo(null);
            setSelectedTodo(null);
            await loadEvents();
            addToast("success", editingTodo ? "Task updated" : "Task created");
          }}
        />
      )}
    </div>
  );
}
