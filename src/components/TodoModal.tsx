"use client";

import React from "react";
import { Modal, Button, DynamicInput, ToastStack } from "@applicator/sdk/components";
import { TodoData, TodoStatus, CategoryData } from "@/src/types";

interface Props {
  calendarId: string;
  categories?: CategoryData[];
  todo?: TodoData | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function TodoModal({ calendarId, categories = [], todo, onClose, onSaved }: Props) {
  const isEditing = !!todo;

  const [summary, setSummary] = React.useState(todo?.summary || "");
  const [description, setDescription] = React.useState(todo?.description || "");
  const [due, setDue] = React.useState(todo?.due ? todo.due.slice(0, 10) : "");
  const [status, setStatus] = React.useState<TodoStatus>(todo?.status || "needs-action");
  const [priority, setPriority] = React.useState(todo?.priority != null ? String(todo.priority) : "");
  const [categoryId, setCategoryId] = React.useState(todo?.categoryId || "");
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<{ type: "success" | "error"; message: string }[]>([]);

  function addToast(type: "success" | "error", message: string) {
    setToasts((t) => [...t, { type, message }]);
  }

  async function handleSave() {
    if (!summary.trim()) { addToast("error", "Summary is required"); return; }
    setSaving(true);
    try {
      const body: any = {
        calendarId,
        summary: summary.trim(),
        description: description.trim(),
        due: due || null,
        allDay: true,
        status,
        priority: priority ? parseInt(priority, 10) : null,
        categoryId: categoryId || null,
      };

      if (status === "completed" && !todo?.completedAt) {
        body.completedAt = new Date().toISOString();
      } else if (status !== "completed") {
        body.completedAt = null;
      }

      const url = isEditing ? `/api/calendars/todos/${todo!.id}` : "/api/calendars/todos";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      onSaved();
    } catch (e: any) {
      addToast("error", e.message);
    } finally {
      setSaving(false);
    }
  }

  const statusOptions = [
    { value: "needs-action", label: "To do" },
    { value: "in-process", label: "In progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const priorityOptions = [
    { value: "", label: "None" },
    { value: "1", label: "High (1)" },
    { value: "5", label: "Medium (5)" },
    { value: "9", label: "Low (9)" },
  ];

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={handleSave} disabled={saving || !summary.trim()}>
        {saving ? "Saving…" : isEditing ? "Save" : "Create"}
      </Button>
    </>
  );

  return (
    <Modal header={isEditing ? "Edit Task" : "New Task"} closeable onClose={onClose} maxWidth={520} footer={footer}>
      <ToastStack toasts={toasts} onClose={(i) => setToasts((t) => t.filter((_, idx) => idx !== i))} />
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <DynamicInput
          input={{ id: "summary", label: "Summary", type: "text", required: true, placeholder: "Task summary" }}
          value={summary}
          onChange={(_, v) => setSummary(v)}
        />

        <DynamicInput
          input={{ id: "description", label: "Description", type: "text", placeholder: "Optional description", lines: 3 }}
          value={description}
          onChange={(_, v) => setDescription(v)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DynamicInput
            input={{ id: "due", label: "Due date", type: "date" }}
            value={due}
            onChange={(_, v) => setDue(v)}
          />

          <DynamicInput
            input={{ id: "status", label: "Status", type: "select", options: statusOptions }}
            value={status}
            onChange={(_, v) => setStatus(v as TodoStatus)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DynamicInput
            input={{ id: "priority", label: "Priority", type: "select", options: priorityOptions }}
            value={priority}
            onChange={(_, v) => setPriority(v)}
          />

          {categories.length > 0 && (
            <DynamicInput
              input={{
                id: "categoryId",
                label: "Category",
                type: "select",
                options: [
                  { value: "", label: "No category" },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ],
              }}
              value={categoryId}
              onChange={(_, v) => setCategoryId(v)}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
