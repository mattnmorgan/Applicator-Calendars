"use client";

import React from "react";
import { Modal, Button, ButtonIcon, DynamicInput, ToastStack } from "@applicator/sdk/components";
import { EventOccurrence, RecurrenceRule, ReminderData, CategoryData } from "@/src/types";

interface Props {
  calendarId: string;
  calendarColor?: string;
  categories?: CategoryData[];
  event?: EventOccurrence | null;
  defaultDate?: Date;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "busy", label: "Busy" },
  { value: "ooo", label: "Out of Office" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ReminderUnit = "minutes" | "hours" | "days";

function toMinutes(value: number, unit: ReminderUnit): number {
  if (unit === "hours") return value * 60;
  if (unit === "days") return value * 1440;
  return value;
}

function formatReminder(minutesBefore: number): string {
  if (minutesBefore % 1440 === 0) return `${minutesBefore / 1440} day${minutesBefore / 1440 !== 1 ? "s" : ""} before`;
  if (minutesBefore % 60 === 0) return `${minutesBefore / 60} hour${minutesBefore / 60 !== 1 ? "s" : ""} before`;
  return `${minutesBefore} minute${minutesBefore !== 1 ? "s" : ""} before`;
}

function toLocalDatetimeString(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateString(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultTimedDates(base?: Date): { start: string; end: string } {
  const interval = 15 * 60 * 1000;
  const startMs = Math.ceil((base || new Date()).getTime() / interval) * interval;
  return {
    start: toLocalDatetimeString(new Date(startMs).toISOString()),
    end: toLocalDatetimeString(new Date(startMs + 60 * 60 * 1000).toISOString()),
  };
}

function defaultAllDayDates(): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { start: today, end: today };
}

function localDatetimeToISO(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return d.toISOString();
}

export default function EventModal({ calendarId, calendarColor, categories = [], event, defaultDate, onClose, onSaved }: Props) {
  const isEditing = !!event;

  const _defaultTimed = defaultTimedDates(defaultDate);

  const [name, setName] = React.useState(event?.name || "");
  const [description, setDescription] = React.useState(event?.description || "");
  const [location, setLocation] = React.useState(event?.location || "");
  const [color, setColor] = React.useState(event?.color || calendarColor || "#3B82F6");
  const [allDay, setAllDay] = React.useState(event?.allDay || false);
  const [status, setStatus] = React.useState<"free" | "busy" | "ooo">(event?.status || "free");
  const [startDate, setStartDate] = React.useState(
    event ? (event.allDay ? toLocalDateString(event.occurrenceStart) : toLocalDatetimeString(event.occurrenceStart))
          : _defaultTimed.start
  );
  const [endDate, setEndDate] = React.useState(
    event ? (event.allDay ? toLocalDateString(event.occurrenceEnd) : toLocalDatetimeString(event.occurrenceEnd))
          : _defaultTimed.end
  );
  const [isRecurring, setIsRecurring] = React.useState(event?.isRecurring || false);
  const [recType, setRecType] = React.useState<"weekly" | "interval">(
    event?.recurrenceRule?.type || "weekly"
  );
  const [recDays, setRecDays] = React.useState<number[]>(event?.recurrenceRule?.days || []);
  const [recInterval, setRecInterval] = React.useState(event?.recurrenceRule?.interval || 1);
  const [recUnit, setRecUnit] = React.useState<"day" | "week" | "month" | "year">(event?.recurrenceRule?.unit || "week");
  const [recEndDate, setRecEndDate] = React.useState(event?.recurrenceRule?.endDate || "");

  const [reminders, setReminders] = React.useState<ReminderData[]>([]);
  const [remindersLoaded, setRemindersLoaded] = React.useState(false);
  const [reminderValue, setReminderValue] = React.useState(30);
  const [reminderUnit, setReminderUnit] = React.useState<ReminderUnit>("minutes");

  const [categoryId, setCategoryId] = React.useState<string>(
    event?.categoryId ?? ""
  );

  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<{ type: "success" | "error"; message: string }[]>([]);

  function addToast(type: "success" | "error", message: string) {
    setToasts((t) => [...t, { type, message }]);
  }

  React.useEffect(() => {
    if (event && !remindersLoaded) {
      fetch(`/api/calendars/events/${event.id}/reminders`)
        .then((r) => r.json())
        .then((d) => { setReminders(d.reminders || []); setRemindersLoaded(true); })
        .catch(() => setRemindersLoaded(true));
    } else {
      setRemindersLoaded(true);
    }
  }, [event?.id]);

  function toggleDay(day: number) {
    setRecDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  async function addReminder() {
    const minutes = toMinutes(reminderValue, reminderUnit);
    if (reminders.some((r) => r.minutesBefore === minutes)) return;

    if (!event) {
      setReminders((prev) => [...prev, { id: `new-${Date.now()}`, eventId: "", userId: "", minutesBefore: minutes }]);
      return;
    }
    try {
      const res = await fetch(`/api/calendars/events/${event.id}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutesBefore: minutes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const r = await res.json();
      setReminders((prev) => [...prev, r]);
    } catch (e: any) {
      addToast("error", e.message);
    }
  }

  async function removeReminder(reminder: ReminderData) {
    if (!event || reminder.id.startsWith("new-")) {
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
      return;
    }
    try {
      await fetch(`/api/calendars/events/${event.id}/reminders/${reminder.id}`, { method: "DELETE" });
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch (e: any) {
      addToast("error", e.message);
    }
  }

  async function handleSave() {
    // Validate
    if (!name.trim()) { addToast("error", "Event name is required"); return; }
    if (!startDate) { addToast("error", "Start date is required"); return; }
    if (!allDay && !endDate) { addToast("error", "End date is required"); return; }

    let startISO: string;
    let endISO: string;

    if (allDay) {
      startISO = new Date(startDate + "T00:00:00Z").toISOString();
      endISO = new Date((endDate || startDate) + "T00:00:00Z").toISOString();
    } else {
      startISO = localDatetimeToISO(startDate);
      endISO = localDatetimeToISO(endDate);
      if (new Date(endISO) < new Date(startISO)) {
        addToast("error", "End date cannot be before start date");
        return;
      }
    }

    if (isRecurring && recType === "weekly" && recDays.length === 0) {
      addToast("error", "Select at least one day for weekly recurrence");
      return;
    }

    const recurrenceRule: RecurrenceRule | null = isRecurring ? {
      type: recType,
      ...(recType === "weekly" ? { days: recDays } : { interval: recInterval, unit: recUnit }),
      ...(recEndDate ? { endDate: recEndDate } : {}),
    } : null;

    setSaving(true);

    try {
      const body = {
        name: name.trim(),
        description,
        location,
        color,
        allDay,
        status,
        startDate: startISO,
        endDate: endISO,
        isRecurring,
        recurrenceRule,
        calendarId,
        categoryId: categoryId || null,
      };

      let eventId: string;
      if (isEditing && event) {
        const res = await fetch(`/api/calendars/events/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { addToast("error", (await res.json()).error || "Failed to save"); return; }
        const saved = await res.json();
        eventId = saved.id;
      } else {
        const res = await fetch("/api/calendars/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { addToast("error", (await res.json()).error || "Failed to create"); return; }
        const saved = await res.json();
        eventId = saved.id;

        for (const r of reminders.filter((r) => r.id.startsWith("new-"))) {
          await fetch(`/api/calendars/events/${eventId}/reminders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ minutesBefore: r.minutesBefore }),
          });
        }
      }

      onSaved();
    } catch (e: any) {
      addToast("error", e.message);
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={handleSave} disabled={saving}>{isEditing ? "Save" : "Create"}</Button>
    </>
  );

  return (
    <Modal header={isEditing ? "Edit Event" : "New Event"} closeable onClose={onClose} maxWidth={560} footer={footer}>
      <ToastStack toasts={toasts} onClose={(i) => setToasts((t) => t.filter((_, idx) => idx !== i))} />
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        <DynamicInput
          input={{ id: "name", label: "Name", type: "text", required: true, placeholder: "Event name" }}
          value={name}
          onChange={(_, v) => setName(v)}
        />

        {/* All day + Start + End: all-day shrinks to natural size, start/end flex with minWidth: 0 */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            <DynamicInput
              input={{ id: "allDay", label: "All day", type: "toggle" }}
              value={allDay}
              onChange={(_, v) => {
                setAllDay(v);
                if (v) {
                  const { start, end } = defaultAllDayDates();
                  setStartDate(start);
                  setEndDate(end);
                } else {
                  const { start, end } = defaultTimedDates();
                  setStartDate(start);
                  setEndDate(end);
                }
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <DynamicInput
              input={{ id: "startDate", label: "Start", type: allDay ? "date" : "datetime" }}
              value={startDate}
              onChange={(_, v) => {
                setStartDate(v);
                if (v > endDate) setEndDate(v);
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <DynamicInput
              input={{ id: "endDate", label: "End", type: allDay ? "date" : "datetime" }}
              value={endDate}
              onChange={(_, v) => {
                setEndDate(v);
                if (v < startDate) setStartDate(v);
              }}
            />
          </div>
        </div>

        {/* Status + Category + Color inline */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <DynamicInput
              input={{ id: "status", label: "Status", type: "select", options: STATUS_OPTIONS }}
              value={status}
              onChange={(_, v) => setStatus(v)}
            />
          </div>
          {categories.length > 0 && (
            <div style={{ flex: 1 }}>
              <DynamicInput
                input={{
                  id: "categoryId",
                  label: "Category",
                  type: "select",
                  placeholder: "None",
                  options: categories.map((c) => ({ value: c.id, label: c.name })),
                }}
                value={categoryId || null}
                onChange={(_, v) => {
                  setCategoryId(v ?? "");
                  if (!v) {
                    setColor(calendarColor || "#3B82F6");
                  } else {
                    const cat = categories.find((c) => c.id === v);
                    if (cat) setColor(cat.color);
                  }
                }}
              />
            </div>
          )}
          <div style={{ flex: 0 }}>
            <DynamicInput
              input={{ id: "color", label: "Color", type: "color" }}
              value={color}
              onChange={(_, v) => setColor(v)}
            />
          </div>
        </div>

        <DynamicInput
          input={{ id: "description", label: "Description", type: "text", lines: 2, resizable: true }}
          value={description}
          onChange={(_, v) => setDescription(v)}
        />

        <DynamicInput
          input={{ id: "location", label: "Location", type: "text", placeholder: "Location" }}
          value={location}
          onChange={(_, v) => setLocation(v)}
        />

        {/* Recurrence */}
        <div>
          <DynamicInput
            input={{ id: "isRecurring", label: "Repeat", type: "toggle" }}
            value={isRecurring}
            onChange={(_, v) => setIsRecurring(v)}
          />

          {isRecurring && (
            <div style={{ marginTop: 10, padding: 12, border: "1px solid #334155", borderRadius: 6, display: "flex", flexDirection: "column", gap: 12 }}>
              <DynamicInput
                input={{
                  id: "recType",
                  label: "Pattern",
                  type: "radio-horizontal-group",
                  options: [
                    { value: "weekly", label: "Weekly" },
                    { value: "interval", label: "Every X" },
                  ],
                }}
                value={recType}
                onChange={(_, v) => setRecType(v)}
              />

              {recType === "weekly" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "1px solid #334155",
                        background: recDays.includes(i) ? "#3B82F6" : "transparent",
                        color: recDays.includes(i) ? "#fff" : "#e2e8f0",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {recType === "interval" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 14, color: "#e2e8f0" }}>Every</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={recInterval}
                    onChange={(e) => setRecInterval(parseInt(e.target.value) || 1)}
                    style={{ width: 60, padding: "6px 8px", border: "1px solid #334155", borderRadius: 6, fontSize: 14, background: "#0f172a", color: "#f1f5f9" }}
                  />
                  <select
                    value={recUnit}
                    onChange={(e) => setRecUnit(e.target.value as any)}
                    style={{ padding: "6px 8px", border: "1px solid #334155", borderRadius: 6, fontSize: 14, background: "#0f172a", color: "#f1f5f9" }}
                  >
                    <option value="day">day(s)</option>
                    <option value="week">week(s)</option>
                    <option value="month">month(s)</option>
                    <option value="year">year(s)</option>
                  </select>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <DynamicInput
                    input={{ id: "recEndDate", label: "End date (optional)", type: "date" }}
                    value={recEndDate}
                    onChange={(_, v) => setRecEndDate(v)}
                  />
                </div>
                {recEndDate && <ButtonIcon name="close" label="Clear end date" onClick={() => setRecEndDate("")} size="sm" />}
              </div>
            </div>
          )}
        </div>

        {/* Reminders */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" }}>Reminders</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reminders.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#e2e8f0" }}>
                <span style={{ flex: 1 }}>{formatReminder(r.minutesBefore)}</span>
                <ButtonIcon name="close" label="Remove reminder" onClick={() => removeReminder(r)} size="sm" />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number"
                min={1}
                max={9999}
                value={reminderValue}
                onChange={(e) => setReminderValue(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 70, padding: "6px 8px", border: "1px solid #334155", borderRadius: 6, fontSize: 13, background: "#0f172a", color: "#f1f5f9" }}
              />
              <select
                value={reminderUnit}
                onChange={(e) => setReminderUnit(e.target.value as ReminderUnit)}
                style={{ padding: "6px 8px", border: "1px solid #334155", borderRadius: 6, fontSize: 13, background: "#0f172a", color: "#f1f5f9" }}
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
              <Button variant="secondary" onClick={addReminder}>Add reminder</Button>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
}
