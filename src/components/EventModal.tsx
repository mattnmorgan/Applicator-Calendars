"use client";

import React from "react";
import { Modal, Button, ButtonIcon, DynamicInput } from "@applicator/sdk/components";
import { EventOccurrence, RecurrenceRule, ReminderData } from "@/src/types";

interface Props {
  calendarId: string;
  event?: EventOccurrence | null;
  defaultDate?: Date;
  onClose: () => void;
  onSaved: () => void;
}

const EVENT_COLORS = [
  "", "#3B82F6", "#EF4444", "#F59E0B", "#10B981",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

const STATUS_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "busy", label: "Busy" },
  { value: "ooo", label: "Out of Office" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const REMINDER_PRESETS = [
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "1 day", value: 1440 },
];

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

function localDatetimeToISO(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return d.toISOString();
}

export default function EventModal({ calendarId, event, defaultDate, onClose, onSaved }: Props) {
  const isEditing = !!event;

  const defaultStart = defaultDate || new Date();
  defaultStart.setMinutes(0, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

  const [name, setName] = React.useState(event?.name || "");
  const [description, setDescription] = React.useState(event?.description || "");
  const [location, setLocation] = React.useState(event?.location || "");
  const [color, setColor] = React.useState(event?.color || "");
  const [allDay, setAllDay] = React.useState(event?.allDay || false);
  const [status, setStatus] = React.useState<"free" | "busy" | "ooo">(event?.status || "free");
  const [startDate, setStartDate] = React.useState(
    event ? (allDay ? toLocalDateString(event.occurrenceStart) : toLocalDatetimeString(event.occurrenceStart))
          : (defaultDate ? toLocalDatetimeString(defaultStart.toISOString()) : toLocalDatetimeString(defaultStart.toISOString()))
  );
  const [endDate, setEndDate] = React.useState(
    event ? (allDay ? toLocalDateString(event.occurrenceEnd) : toLocalDatetimeString(event.occurrenceEnd))
          : toLocalDatetimeString(defaultEnd.toISOString())
  );
  const [isRecurring, setIsRecurring] = React.useState(event?.isRecurring || false);
  const [recType, setRecType] = React.useState<"weekly" | "interval">(
    event?.recurrenceRule?.type || "weekly"
  );
  const [recDays, setRecDays] = React.useState<number[]>(event?.recurrenceRule?.days || []);
  const [recInterval, setRecInterval] = React.useState(event?.recurrenceRule?.interval || 1);
  const [recUnit, setRecUnit] = React.useState<"day" | "week" | "month">(event?.recurrenceRule?.unit || "week");
  const [recEndDate, setRecEndDate] = React.useState(event?.recurrenceRule?.endDate || "");

  const [reminders, setReminders] = React.useState<ReminderData[]>([]);
  const [remindersLoaded, setRemindersLoaded] = React.useState(false);
  const [newReminderMinutes, setNewReminderMinutes] = React.useState(30);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

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
    if (!event) {
      setReminders((prev) => [...prev, { id: `new-${Date.now()}`, eventId: "", userId: "", minutesBefore: newReminderMinutes }]);
      return;
    }
    try {
      const res = await fetch(`/api/calendars/events/${event.id}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutesBefore: newReminderMinutes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const r = await res.json();
      setReminders((prev) => [...prev, r]);
    } catch (e: any) {
      setError(e.message);
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
      setError(e.message);
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }

    const recurrenceRule: RecurrenceRule | null = isRecurring ? {
      type: recType,
      ...(recType === "weekly" ? { days: recDays } : { interval: recInterval, unit: recUnit }),
      ...(recEndDate ? { endDate: recEndDate } : {}),
    } : null;

    let startISO: string;
    let endISO: string;

    if (allDay) {
      startISO = new Date(startDate + "T00:00:00Z").toISOString();
      endISO = new Date(endDate + "T00:00:00Z").toISOString();
    } else {
      startISO = localDatetimeToISO(startDate);
      endISO = localDatetimeToISO(endDate);
    }

    setSaving(true);
    setError("");

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
      };

      let eventId: string;
      if (isEditing && event) {
        const res = await fetch(`/api/calendars/events/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
        const saved = await res.json();
        eventId = saved.id;
      } else {
        const res = await fetch("/api/calendars/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to create");
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
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal header={isEditing ? "Edit Event" : "New Event"} closeable onClose={onClose} maxWidth={560}>
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14, maxHeight: "65vh", overflowY: "auto" }}>

        <DynamicInput
          input={{ id: "name", label: "Name", type: "text", required: true, placeholder: "Event name" }}
          value={name}
          onChange={(_, v) => setName(v)}
        />

        <DynamicInput
          input={{ id: "allDay", label: "All day", type: "toggle" }}
          value={allDay}
          onChange={(_, v) => setAllDay(v)}
        />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <DynamicInput
              input={{ id: "startDate", label: "Start", type: allDay ? "date" : "datetime" }}
              value={startDate}
              onChange={(_, v) => setStartDate(v)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <DynamicInput
              input={{ id: "endDate", label: "End", type: allDay ? "date" : "datetime" }}
              value={endDate}
              onChange={(_, v) => setEndDate(v)}
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

        <DynamicInput
          input={{ id: "status", label: "Status", type: "select", options: STATUS_OPTIONS }}
          value={status}
          onChange={(_, v) => setStatus(v)}
        />

        {/* Color — keep custom swatch to support the "auto/calendar default" empty-string option */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#e2e8f0" }}>Color</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => setColor("")}
              style={{ width: 28, height: 28, borderRadius: "50%", background: "#334155", border: color === "" ? "3px solid #e2e8f0" : "2px solid transparent", cursor: "pointer", padding: 0, outline: "none", fontSize: 11, color: "#e2e8f0" }}
              title="Calendar default"
            >
              auto
            </button>
            {EVENT_COLORS.filter(Boolean).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "3px solid #e2e8f0" : "2px solid transparent", cursor: "pointer", padding: 0, outline: "none" }}
              />
            ))}
          </div>
        </div>

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
                <span style={{ flex: 1 }}>
                  {r.minutesBefore < 60
                    ? `${r.minutesBefore} minute${r.minutesBefore !== 1 ? "s" : ""} before`
                    : r.minutesBefore < 1440
                    ? `${r.minutesBefore / 60} hour${r.minutesBefore / 60 !== 1 ? "s" : ""} before`
                    : `${r.minutesBefore / 1440} day${r.minutesBefore / 1440 !== 1 ? "s" : ""} before`}
                </span>
                <ButtonIcon name="close" label="Remove reminder" onClick={() => removeReminder(r)} size="sm" />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={newReminderMinutes}
                onChange={(e) => setNewReminderMinutes(parseInt(e.target.value))}
                style={{ padding: "6px 8px", border: "1px solid #334155", borderRadius: 6, fontSize: 13, background: "#0f172a", color: "#f1f5f9" }}
              >
                {REMINDER_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <Button variant="secondary" onClick={addReminder}>Add reminder</Button>
            </div>
          </div>
        </div>

        {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{isEditing ? "Save" : "Create"}</Button>
        </div>
      </div>
    </Modal>
  );
}
