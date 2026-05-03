"use client";

import React from "react";
import { Modal, Button, DynamicInput } from "@applicator/sdk/components";

type Tab = "create" | "import";

interface ImportPayload {
  events: any[];
  categories: any[];
  subscriptions: any[];
}

interface Props {
  onClose: () => void;
  onCreate: (data: { name: string; description: string; color: string }) => Promise<void>;
  onImport: (calData: { name: string; description: string; color: string; defaultView?: string }, payload: ImportPayload) => Promise<void>;
}

export default function NewCalendarModal({ onClose, onCreate, onImport }: Props) {
  const [tab, setTab] = React.useState<Tab>("create");

  // ── Create tab state ──────────────────────────────────────────────────────
  const [values, setValues] = React.useState({ name: "", description: "", color: "#3B82F6" });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  // ── Import tab state ──────────────────────────────────────────────────────
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importParsed, setImportParsed] = React.useState<any>(null);
  const [importName, setImportName] = React.useState("");
  const [importFileError, setImportFileError] = React.useState("");
  const [importSaving, setImportSaving] = React.useState(false);
  const [importError, setImportError] = React.useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileError("");
    setImportParsed(null);
    setImportError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.calendar || !Array.isArray(parsed.events)) {
          setImportFileError("Not a valid calendar export file");
          return;
        }
        setImportParsed(parsed);
        setImportName(parsed.calendar.name || "");
      } catch {
        setImportFileError("Could not parse file — make sure it is a JSON export");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleCreate() {
    if (!values.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onCreate({ name: values.name.trim(), description: values.description.trim(), color: values.color || "#3B82F6" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImportSubmit() {
    if (!importParsed) return;
    if (!importName.trim()) { setImportError("Name is required"); return; }
    setImportSaving(true);
    setImportError("");
    try {
      await onImport(
        {
          name: importName.trim(),
          description: importParsed.calendar.description || "",
          color: importParsed.calendar.color || "#3B82F6",
          defaultView: importParsed.calendar.defaultView || "week",
        },
        {
          events: importParsed.events || [],
          categories: importParsed.categories || [],
          subscriptions: importParsed.subscriptions || [],
        }
      );
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setImportSaving(false);
    }
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1,
    padding: "10px 0",
    border: "none",
    borderBottom: tab === t ? "2px solid #3B82F6" : "2px solid transparent",
    background: "transparent",
    color: tab === t ? "#3B82F6" : "#94a3b8",
    fontWeight: tab === t ? 700 : 400,
    fontSize: 14,
    cursor: "pointer",
  });

  const eventCount = importParsed
    ? (importParsed.events || []).filter((e: any) => !e.icsSubscriptionId).length
    : 0;
  const categoryCount = importParsed ? (importParsed.categories || []).length : 0;
  const subCount = importParsed ? (importParsed.subscriptions || []).length : 0;

  return (
    <Modal header="New Calendar" closeable onClose={onClose} maxWidth={440}>
      {/* Tab strip */}
      <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
        <button style={tabStyle("create")} onClick={() => setTab("create")}>Create</button>
        <button style={tabStyle("import")} onClick={() => setTab("import")}>Import</button>
      </div>

      {/* Create tab */}
      {tab === "create" && (
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <DynamicInput
            input={{ id: "name", label: "Name", type: "text", required: true, placeholder: "Calendar name" }}
            value={values.name}
            onChange={(_, v) => setValues((p) => ({ ...p, name: v }))}
          />
          <DynamicInput
            input={{ id: "description", label: "Description", type: "text", lines: 2, resizable: true, placeholder: "Optional description" }}
            value={values.description}
            onChange={(_, v) => setValues((p) => ({ ...p, description: v }))}
          />
          <DynamicInput
            input={{ id: "color", label: "Color", type: "color" }}
            value={values.color}
            onChange={(_, v) => setValues((p) => ({ ...p, color: v }))}
          />
          {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={saving}>Create</Button>
          </div>
        </div>
      )}

      {/* Import tab */}
      {tab === "import" && (
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {!importParsed ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0" }}>
              <div style={{ fontSize: 14, color: "#94a3b8", textAlign: "center" }}>
                Select a JSON file exported from a calendar to create a new calendar from it.
              </div>
              {importFileError && (
                <div style={{ color: "#EF4444", fontSize: 13, textAlign: "center" }}>{importFileError}</div>
              )}
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>Choose file</Button>
            </div>
          ) : (
            <>
              <DynamicInput
                input={{ id: "importName", label: "Calendar name", type: "text", required: true }}
                value={importName}
                onChange={(_, v) => setImportName(v)}
              />

              <div style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 6,
                padding: "10px 14px",
                display: "flex",
                gap: 16,
                fontSize: 13,
                color: "#94a3b8",
              }}>
                <span><span style={{ color: "#e2e8f0", fontWeight: 600 }}>{categoryCount}</span> {categoryCount === 1 ? "category" : "categories"}</span>
                <span><span style={{ color: "#e2e8f0", fontWeight: 600 }}>{eventCount}</span> {eventCount === 1 ? "event" : "events"}</span>
                <span><span style={{ color: "#e2e8f0", fontWeight: 600 }}>{subCount}</span> {subCount === 1 ? "subscription" : "subscriptions"}</span>
              </div>

              <button
                onClick={() => { setImportParsed(null); setImportName(""); setImportError(""); fileRef.current?.click(); }}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0, textDecoration: "underline" }}
              >
                Choose a different file
              </button>

              {importError && <div style={{ color: "#EF4444", fontSize: 13 }}>{importError}</div>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleImportSubmit} disabled={importSaving}>Import</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
