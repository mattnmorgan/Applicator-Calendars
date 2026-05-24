"use client";

import React from "react";
import { ButtonIcon, Tooltip } from "@applicator/sdk/components";
import { datetime } from "@applicator/sdk/utilities";
import { EventOccurrence, CalendarData, CategoryData, ViewMode, TodoData } from "@/src/types";

const { addDays, getWeekStart, formatDate, parseDate, getMonthStart, formatTime, formatDayHeader, getTimeSinceRefresh } = datetime;

interface Props {
  viewMode: ViewMode;
  currentDate: Date;
  events: EventOccurrence[];
  todos?: TodoData[];
  calendars: CalendarData[];
  categories?: CategoryData[];
  onEventClick: (event: EventOccurrence) => void;
  onTodoClick?: (todo: TodoData) => void;
  onNavigate: (direction: "prev" | "next" | "today") => void;
  lastRefreshed: Date | null;
  onRefresh: () => void;
  refreshing?: boolean;
  onNewEvent?: () => void;
  onNewTodo?: () => void;
  onSettings?: () => void;
}

const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad = (n: number) => String(n).padStart(2, "0");

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function occurrenceDateLocal(ev: EventOccurrence): string {
  if (ev.allDay) return ev.occurrenceDate;
  return localDateStr(new Date(ev.occurrenceStart));
}

function getEventColor(ev: EventOccurrence, calendars: CalendarData[], categories: CategoryData[]): string {
  if (ev.color) return ev.color;
  if (ev.categoryId) {
    const cat = categories.find((c) => c.id === ev.categoryId);
    if (cat) return cat.color;
  }
  const cal = calendars.find((c) => c.id === ev.calendarId);
  return cal?.color || "#3B82F6";
}

function getDaysForView(viewMode: ViewMode, currentDate: Date): Date[] {
  if (viewMode === "today") return [new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()))];
  if (viewMode === "3days") {
    const base = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));
    return [base, addDays(base, 1), addDays(base, 2)];
  }
  if (viewMode === "week") {
    const ws = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }
  return [];
}

function getDateRangeLabel(viewMode: ViewMode, currentDate: Date): string {
  if (viewMode === "today") {
    return currentDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  if (viewMode === "3days") {
    const end = addDays(currentDate, 2);
    return `${currentDate.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  if (viewMode === "week") {
    const ws = getWeekStart(currentDate);
    const we = addDays(ws, 6);
    return `${ws.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })} – ${we.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  if (viewMode === "month") {
    return currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return "Agenda";
}


// ─── Time Grid View ─────────────────────────────────────────────────────────

function getTodoColor(todo: TodoData, calendars: CalendarData[], categories: CategoryData[]): string {
  if (todo.color) return todo.color;
  if (todo.categoryId) {
    const cat = categories.find((c) => c.id === todo.categoryId);
    if (cat) return cat.color;
  }
  const cal = calendars.find((c) => c.id === todo.calendarId);
  return cal?.color || "#3B82F6";
}

function TimeGridView({ days, events, todos, calendars, categories, onEventClick, onTodoClick }: {
  days: Date[];
  events: EventOccurrence[];
  todos: TodoData[];
  calendars: CalendarData[];
  categories: CategoryData[];
  onEventClick: (ev: EventOccurrence) => void;
  onTodoClick: (todo: TodoData) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const now = new Date();

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, now.getHours() * HOUR_HEIGHT - 100);
    }
  }, []);

  const allDayEvents = events.filter((e) => e.allDay);
  const timedEvents = events.filter((e) => !e.allDay);
  const todosWithDue = todos.filter((t) => t.due);

  const todayStr = formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Day header */}
      <div style={{ display: "flex", borderBottom: "1px solid #334155", flexShrink: 0 }}>
        <div style={{ width: 56, flexShrink: 0 }} />
        {days.map((day) => {
          const { dayNum, dayName } = formatDayHeader(day);
          const isToday = formatDate(day) === todayStr;
          return (
            <div key={formatDate(day)} style={{ flex: 1, textAlign: "center", padding: "8px 4px" }}>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{dayName}</div>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: isToday ? "#3B82F6" : "transparent",
                color: isToday ? "#fff" : "inherit",
                fontWeight: 600,
                fontSize: 15,
              }}>
                {dayNum}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      {(allDayEvents.length > 0 || todosWithDue.length > 0) && (
        <div style={{ display: "flex", borderBottom: "1px solid #334155", flexShrink: 0, minHeight: 32 }}>
          <div style={{ width: 56, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, opacity: 0.5 }}>all-day</div>
          {days.map((day) => {
            const dayStr = formatDate(day);
            const dayAllDay = allDayEvents.filter((e) => e.occurrenceDate === dayStr);
            const dayTodos = todosWithDue.filter((t) => t.due!.slice(0, 10) === dayStr);
            return (
              <div key={dayStr} style={{ flex: 1, padding: "2px 4px", display: "flex", flexDirection: "column", gap: 2 }}>
                {dayAllDay.map((ev) => (
                  <button
                    key={ev.id + ev.occurrenceDate}
                    onClick={() => onEventClick(ev)}
                    style={{
                      background: getEventColor(ev, calendars, categories),
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      padding: "2px 6px",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                    }}
                  >
                    {ev.name}
                  </button>
                ))}
                {dayTodos.map((todo) => (
                  <button
                    key={todo.id}
                    onClick={() => onTodoClick(todo)}
                    style={{
                      background: "transparent",
                      color: "#e2e8f0",
                      border: `1px solid ${getTodoColor(todo, calendars, categories)}`,
                      borderRadius: 3,
                      padding: "1px 6px",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                      opacity: todo.status === "completed" ? 0.5 : 1,
                    }}
                  >
                    {todo.summary}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", position: "relative", minHeight: 0 }}>
        <div style={{ display: "flex", position: "relative", height: 24 * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div style={{ width: 56, flexShrink: 0, position: "relative" }}>
            {HOURS.map((h) => (
              <div
                key={h}
                style={{
                  position: "absolute",
                  top: h * HOUR_HEIGHT - 8,
                  right: 8,
                  fontSize: 11,
                  opacity: 0.5,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {h === 0 ? "" : `${h}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayStr = formatDate(day);
            const dayEvents = timedEvents.filter((e) => occurrenceDateLocal(e) === dayStr);

            return (
              <div key={dayStr} style={{ flex: 1, position: "relative", borderLeft: "1px solid #334155" }}>
                {/* Hour lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{
                      position: "absolute",
                      top: h * HOUR_HEIGHT,
                      left: 0,
                      right: 0,
                      borderTop: "1px solid #334155",
                      opacity: 0.5,
                    }}
                  />
                ))}

                {/* Current time indicator */}
                {formatDate(day) === todayStr && (
                  <div style={{
                    position: "absolute",
                    top: (now.getHours() * 60 + now.getMinutes()) * (HOUR_HEIGHT / 60),
                    left: 0,
                    right: 0,
                    height: 2,
                    background: "#EF4444",
                    zIndex: 5,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", marginTop: -3, marginLeft: -4 }} />
                  </div>
                )}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const start = new Date(ev.occurrenceStart);
                  const end = new Date(ev.occurrenceEnd);
                  const startMins = start.getHours() * 60 + start.getMinutes();
                  const endMins = end.getHours() * 60 + end.getMinutes();
                  const topPx = startMins * (HOUR_HEIGHT / 60);
                  const heightPx = Math.max(20, (endMins - startMins) * (HOUR_HEIGHT / 60));

                  return (
                    <button
                      key={ev.id + ev.occurrenceDate}
                      onClick={() => onEventClick(ev)}
                      style={{
                        position: "absolute",
                        top: topPx,
                        left: 2,
                        right: 2,
                        height: heightPx,
                        background: getEventColor(ev, calendars, categories),
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        padding: "2px 6px",
                        cursor: "pointer",
                        textAlign: "left",
                        overflow: "hidden",
                        zIndex: 3,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.name}
                      </div>
                      {heightPx >= 36 && (
                        <div style={{ opacity: 0.85, fontSize: 11 }}>
                          {formatTime(ev.occurrenceStart)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────────────────────────

function MonthView({ currentDate, events, todos, calendars, categories, onEventClick, onTodoClick, onDayClick }: {
  currentDate: Date;
  events: EventOccurrence[];
  todos: TodoData[];
  calendars: CalendarData[];
  categories: CategoryData[];
  onEventClick: (ev: EventOccurrence) => void;
  onTodoClick: (todo: TodoData) => void;
  onDayClick: (day: Date) => void;
}) {
  const monthStart = getMonthStart(currentDate);
  const weekStart = getWeekStart(monthStart);
  const _now = new Date();
  const todayStr = formatDate(new Date(Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate())));
  const currentMonthStr = `${currentDate.getUTCFullYear()}-${pad(currentDate.getUTCMonth() + 1)}`;

  const cells: Date[] = [];
  let d = new Date(weekStart);
  while (cells.length < 42) {
    cells.push(new Date(d));
    d = addDays(d, 1);
  }

  const weeks = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Day name header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #334155" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{ padding: "6px 0", textAlign: "center", fontSize: 12, fontWeight: 600, opacity: 0.6 }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, display: "grid", gridTemplateRows: "repeat(6, 1fr)", overflow: "hidden" }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #334155" }}>
            {week.map((day) => {
              const dayStr = formatDate(day);
              const isToday = dayStr === todayStr;
              const isCurrentMonth = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}` === currentMonthStr;
              const dayEvents = events.filter((e) => occurrenceDateLocal(e) === dayStr).sort((a, b) => a.occurrenceStart.localeCompare(b.occurrenceStart));
              const dayTodos = todos.filter((t) => t.due && t.due.slice(0, 10) === dayStr);
              const allItems = dayEvents.length + dayTodos.length;
              const maxVisible = 3;
              const overflow = allItems - maxVisible;

              return (
                <div
                  key={dayStr}
                  style={{
                    borderRight: "1px solid #334155",
                    padding: "4px",
                    overflow: "hidden",
                    opacity: isCurrentMonth ? 1 : 0.4,
                    cursor: "pointer",
                  }}
                  onClick={() => onDayClick(day)}
                >
                  <Tooltip text="View day" placement="top">
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: isToday ? "#3B82F6" : "transparent",
                        color: isToday ? "#fff" : "inherit",
                        fontWeight: isToday ? 700 : 400,
                        fontSize: 13,
                        marginBottom: 2,
                      }}
                    >
                      {day.getUTCDate()}
                    </div>
                  </Tooltip>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {dayEvents.slice(0, maxVisible).map((ev) => (
                      <button
                        key={ev.id + ev.occurrenceDate}
                        onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                        style={{
                          background: getEventColor(ev, calendars, categories),
                          color: "#fff",
                          border: "none",
                          borderRadius: 2,
                          padding: "1px 4px",
                          fontSize: 11,
                          cursor: "pointer",
                          textAlign: "left",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          width: "100%",
                        }}
                      >
                        {!ev.allDay && <span style={{ opacity: 0.85, marginRight: 2 }}>{formatTime(ev.occurrenceStart)}</span>}
                        {ev.name}
                      </button>
                    ))}
                    {dayTodos.slice(0, Math.max(0, maxVisible - dayEvents.length)).map((todo) => (
                      <button
                        key={todo.id}
                        onClick={(e) => { e.stopPropagation(); onTodoClick(todo); }}
                        style={{
                          background: "transparent",
                          color: "#e2e8f0",
                          border: `1px solid ${getTodoColor(todo, calendars, categories)}`,
                          borderRadius: 2,
                          padding: "1px 4px",
                          fontSize: 11,
                          cursor: "pointer",
                          textAlign: "left",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          width: "100%",
                          opacity: todo.status === "completed" ? 0.5 : 1,
                          boxSizing: "border-box",
                        }}
                      >
                        {todo.summary}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDayClick(day); }}
                        style={{ fontSize: 11, opacity: 0.6, paddingLeft: 4, background: "none", border: "none", color: "inherit", cursor: "pointer", textAlign: "left" }}
                      >
                        +{overflow} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Agenda View ─────────────────────────────────────────────────────────────

const TODO_STATUS_LABEL: Record<string, string> = {
  "needs-action": "To do",
  "in-process": "In progress",
  "completed": "Completed",
  "cancelled": "Cancelled",
};

function AgendaView({ events, todos, calendars, categories, onEventClick, onTodoClick }: {
  events: EventOccurrence[];
  todos: TodoData[];
  calendars: CalendarData[];
  categories: CategoryData[];
  onEventClick: (ev: EventOccurrence) => void;
  onTodoClick: (todo: TodoData) => void;
}) {
  const grouped: Record<string, { events: EventOccurrence[]; todos: TodoData[] }> = {};
  for (const ev of events) {
    const key = occurrenceDateLocal(ev);
    if (!grouped[key]) grouped[key] = { events: [], todos: [] };
    grouped[key].events.push(ev);
  }
  for (const todo of todos) {
    if (!todo.due) continue;
    const key = todo.due.slice(0, 10);
    if (!grouped[key]) grouped[key] = { events: [], todos: [] };
    grouped[key].todos.push(todo);
  }

  const dates = Object.keys(grouped).sort();
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);

  if (dates.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5, fontSize: 14 }}>
        No upcoming events or tasks
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px", minHeight: 0 }}>
      {dates.map((dateStr) => {
        const d = parseDate(dateStr);
        const label = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
        const { events: dayEvents, todos: dayTodos } = grouped[dateStr];
        return (
          <div key={dateStr} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.6, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #334155" }}>
              {label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dayEvents.map((ev) => {
                const evKey = ev.id + ev.occurrenceDate;
                return (
                <button
                  key={evKey}
                  onClick={() => onEventClick(ev)}
                  onMouseEnter={() => setHoveredKey(evKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "8px 12px",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    background: hoveredKey === evKey ? "#273548" : "#1e293b",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{ width: 4, height: "100%", minHeight: 20, borderRadius: 2, background: getEventColor(ev, calendars, categories), flexShrink: 0, alignSelf: "stretch" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.name}</div>
                    {!ev.allDay && (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {formatTime(ev.occurrenceStart)} – {formatTime(ev.occurrenceEnd)}
                      </div>
                    )}
                    {ev.allDay && <div style={{ fontSize: 12, opacity: 0.7 }}>All day</div>}
                    {ev.location && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{ev.location}</div>}
                  </div>
                </button>
              );
              })}
              {dayTodos.map((todo) => {
                const todoKey = "todo-" + todo.id;
                const color = getTodoColor(todo, calendars, categories);
                return (
                  <button
                    key={todoKey}
                    onClick={() => onTodoClick(todo)}
                    onMouseEnter={() => setHoveredKey(todoKey)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "8px 12px",
                      border: `1px solid ${color}33`,
                      borderRadius: 8,
                      background: hoveredKey === todoKey ? "#273548" : "#1e293b",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      transition: "background 0.1s",
                      opacity: todo.status === "completed" ? 0.6 : 1,
                    }}
                  >
                    <div style={{ width: 4, height: "100%", minHeight: 20, borderRadius: 2, border: `2px solid ${color}`, background: "transparent", flexShrink: 0, alignSelf: "stretch" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, textDecoration: todo.status === "completed" ? "line-through" : "none" }}>
                        {todo.summary}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{TODO_STATUS_LABEL[todo.status] || todo.status}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Day Flyout ───────────────────────────────────────────────────────────────

function DayFlyout({ day, events, todos, calendars, categories, onEventClick, onTodoClick, onClose }: {
  day: Date;
  events: EventOccurrence[];
  todos: TodoData[];
  calendars: CalendarData[];
  categories: CategoryData[];
  onEventClick: (ev: EventOccurrence) => void;
  onTodoClick: (todo: TodoData) => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = React.useState(false);
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const dayStr = formatDate(day);
  const dayEvents = events
    .filter((e) => occurrenceDateLocal(e) === dayStr)
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.occurrenceStart.localeCompare(b.occurrenceStart);
    });
  const dayTodos = todos.filter((t) => t.due && t.due.slice(0, 10) === dayStr);

  const label = day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: "45%",
        minWidth: 280,
        background: "#1e293b",
        borderLeft: "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        zIndex: 20,
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s ease",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #334155",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        <ButtonIcon name="close" label="Close" onClick={onClose} size="sm" />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
        {dayEvents.length === 0 && dayTodos.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5, fontSize: 14 }}>
            No events or tasks this day
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
            {dayEvents.map((ev) => {
              const evKey = ev.id + ev.occurrenceDate;
              return (
              <button
                key={evKey}
                onClick={() => onEventClick(ev)}
                onMouseEnter={() => setHoveredKey(evKey)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 12px",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  background: hoveredKey === evKey ? "#1e293b" : "#0f172a",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "background 0.1s",
                }}
              >
                <div style={{ width: 4, borderRadius: 2, background: getEventColor(ev, calendars, categories), flexShrink: 0, alignSelf: "stretch", minHeight: 20 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.name}</div>
                  {ev.allDay ? (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>All day</div>
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {formatTime(ev.occurrenceStart)} – {formatTime(ev.occurrenceEnd)}
                    </div>
                  )}
                  {ev.location && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{ev.location}</div>}
                </div>
              </button>
              );
            })}
            {dayTodos.map((todo) => {
              const todoKey = "todo-" + todo.id;
              const color = getTodoColor(todo, calendars, categories);
              return (
                <button
                  key={todoKey}
                  onClick={() => onTodoClick(todo)}
                  onMouseEnter={() => setHoveredKey(todoKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 12px",
                    border: `1px solid ${color}44`,
                    borderRadius: 8,
                    background: hoveredKey === todoKey ? "#1e293b" : "#0f172a",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "background 0.1s",
                    opacity: todo.status === "completed" ? 0.6 : 1,
                  }}
                >
                  <div style={{ width: 4, borderRadius: 2, border: `2px solid ${color}`, background: "transparent", flexShrink: 0, alignSelf: "stretch", minHeight: 20 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, textDecoration: todo.status === "completed" ? "line-through" : "none" }}>
                      {todo.summary}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{TODO_STATUS_LABEL[todo.status] || todo.status}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── View Mode Tabs ──────────────────────────────────────────────────────────

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "3days", label: "3 Days" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "agenda", label: "Agenda" },
];

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function CalendarView({
  viewMode,
  currentDate,
  events,
  todos = [],
  calendars,
  categories = [],
  onEventClick,
  onTodoClick,
  onNavigate,
  lastRefreshed,
  onRefresh,
  onNewEvent,
  onNewTodo,
  onSettings,
}: Props) {
  const days = getDaysForView(viewMode, currentDate);
  const dateLabel = getDateRangeLabel(viewMode, currentDate);
  const refreshLabel = lastRefreshed ? getTimeSinceRefresh(lastRefreshed) : "";

  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);

  function handleDayEventClick(ev: EventOccurrence) {
    setSelectedDay(null);
    onEventClick(ev);
  }

  function handleDayTodoClick(todo: TodoData) {
    setSelectedDay(null);
    onTodoClick?.(todo);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, position: "relative" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderBottom: "1px solid #334155",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {/* View mode selector */}
        <div style={{ display: "flex", gap: 0, border: "1px solid #334155", borderRadius: 6, overflow: "hidden" }}>
          {VIEW_MODES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onNavigate && id !== viewMode && (onNavigate as any)(id)}
              style={{
                padding: "5px 12px",
                border: "none",
                background: viewMode === id ? "#3B82F6" : "transparent",
                color: viewMode === id ? "#fff" : "inherit",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: viewMode === id ? 600 : 400,
                transition: "background 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ButtonIcon name="chevron-left" label="Previous" onClick={() => onNavigate("prev")} size="sm" />
          <button
            onClick={() => onNavigate("today")}
            style={{ padding: "4px 10px", border: "1px solid #334155", borderRadius: 5, background: "transparent", cursor: "pointer", fontSize: 13, color: "#e2e8f0" }}
          >
            Today
          </button>
          <ButtonIcon name="chevron-right" label="Next" onClick={() => onNavigate("next")} size="sm" />
        </div>

        {/* Date label */}
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{dateLabel}</span>

        {/* Refresh + new event + settings */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {refreshLabel && (
            <span style={{ fontSize: 12, opacity: 0.5 }}>Updated {refreshLabel}</span>
          )}
          <ButtonIcon name="refresh" label="Refresh" onClick={onRefresh} size="sm" />
          {onNewEvent && <ButtonIcon name="plus" label="New event" onClick={onNewEvent} size="sm" />}
          {onNewTodo && <ButtonIcon name="check-circle" label="New task" onClick={onNewTodo} size="sm" />}
          {onSettings && <ButtonIcon name="settings" label="Calendar settings" onClick={onSettings} size="sm" />}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        {(viewMode === "today" || viewMode === "3days" || viewMode === "week") && days.length > 0 && (
          <TimeGridView days={days} events={events} todos={todos} calendars={calendars} categories={categories} onEventClick={onEventClick} onTodoClick={(t) => onTodoClick?.(t)} />
        )}
        {viewMode === "month" && (
          <MonthView currentDate={currentDate} events={events} todos={todos} calendars={calendars} categories={categories} onEventClick={onEventClick} onTodoClick={(t) => onTodoClick?.(t)} onDayClick={(day) => setSelectedDay(day)} />
        )}
        {viewMode === "agenda" && (
          <AgendaView events={events} todos={todos} calendars={calendars} categories={categories} onEventClick={onEventClick} onTodoClick={(t) => onTodoClick?.(t)} />
        )}
      </div>

      {/* Day flyout overlay (month view day click) */}
      {selectedDay && (
        <>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 10 }}
            onClick={() => setSelectedDay(null)}
          />
          <DayFlyout
            day={selectedDay}
            events={events}
            todos={todos}
            calendars={calendars}
            categories={categories}
            onEventClick={handleDayEventClick}
            onTodoClick={handleDayTodoClick}
            onClose={() => setSelectedDay(null)}
          />
        </>
      )}
    </div>
  );
}
