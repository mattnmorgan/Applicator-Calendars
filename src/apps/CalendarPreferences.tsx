"use client";

import React from "react";
import { ButtonIcon, Spinner } from "@applicator/sdk/components";
import { UiContext } from "@applicator/sdk/context";

interface Props {
  context?: UiContext;
}

const VIEW_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Use calendar's default" },
  { value: "today", label: "Today" },
  { value: "3days", label: "Next 3 Days" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "agenda", label: "Agenda" },
];

export default function CalendarPreferences({ context: _context }: Props) {
  const [defaultView, setDefaultView] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    fetch("/api/calendars/preferences")
      .then((r) => r.json())
      .then((d) => {
        setDefaultView(d.defaultView || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/calendars/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultView }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error || "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 560, color: "white" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Calendar Preferences</h3>
        <ButtonIcon
          name={saved ? "check" : "save"}
          label={saving ? "Saving…" : "Save preferences"}
          onClick={handleSave}
          disabled={saving}
        />
      </div>
      <p style={{ margin: "0 0 24px", fontSize: 14, opacity: 0.6 }}>
        Customize how the Calendars app behaves for you.
      </p>

      {error && (
        <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      {/* Preference rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Default view row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Default Calendar View</div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>
              When opening the Calendars app, this view will be used. If left as "Use calendar's default", the selected calendar's configured default view will apply.
            </div>
          </div>
          <select
            value={defaultView}
            onChange={(e) => setDefaultView(e.target.value)}
            style={{
              padding: "7px 10px",
              border: "1px solid #334155",
              borderRadius: 6,
              fontSize: 13,
              background: "#0f172a",
              color: "#f1f5f9",
              flexShrink: 0,
            }}
          >
            {VIEW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
