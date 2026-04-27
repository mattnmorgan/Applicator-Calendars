"use client";

import React from "react";
import { Button, Spinner } from "@applicator/sdk/components";
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
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
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
    <div style={{ padding: 24, maxWidth: 480 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Calendar Preferences</h3>
      <p style={{ margin: "0 0 24px", fontSize: 14, opacity: 0.6 }}>
        Customize how the Calendars app behaves for you.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          Default Calendar View
        </label>
        <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.6 }}>
          When opening the Calendars app, this view will be used. If left as "Use calendar's default",
          the selected calendar's configured default view will apply.
        </p>
        <select
          value={defaultView}
          onChange={(e) => setDefaultView(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #334155",
            borderRadius: 6,
            fontSize: 14,
            background: "#0f172a",
            color: "#f1f5f9",
            minWidth: 200,
          }}
        >
          {VIEW_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {error && <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {saved && <div style={{ color: "#10B981", fontSize: 13, marginBottom: 12 }}>Preferences saved.</div>}

      <Button variant="primary" onClick={handleSave} disabled={saving}>
        Save Preferences
      </Button>
    </div>
  );
}
