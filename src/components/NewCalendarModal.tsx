"use client";

import React from "react";
import { Modal, Button, DynamicInput } from "@applicator/sdk/components";

interface Props {
  onClose: () => void;
  onCreate: (data: { name: string; description: string; color: string }) => void;
}

export default function NewCalendarModal({ onClose, onCreate }: Props) {
  const [values, setValues] = React.useState<Record<string, any>>({
    name: "",
    description: "",
    color: "#3B82F6",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  function handleChange(id: string, value: any) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSave() {
    if (!values.name?.trim()) { setError("Name is required"); return; }
    setSaving(true);
    try {
      await onCreate({
        name: values.name.trim(),
        description: (values.description || "").trim(),
        color: values.color || "#3B82F6",
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal header="New Calendar" closeable onClose={onClose} maxWidth={440}>
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <DynamicInput
          input={{ id: "name", label: "Name", type: "text", required: true, placeholder: "Calendar name" }}
          value={values.name ?? ""}
          onChange={handleChange}
        />
        <DynamicInput
          input={{ id: "description", label: "Description", type: "text", lines: 2, resizable: true, placeholder: "Optional description" }}
          value={values.description ?? ""}
          onChange={handleChange}
        />
        <DynamicInput
          input={{ id: "color", label: "Color", type: "color" }}
          value={values.color ?? "#3B82F6"}
          onChange={handleChange}
        />

        {error && (
          <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>Create</Button>
        </div>
      </div>
    </Modal>
  );
}
