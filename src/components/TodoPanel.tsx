"use client";

import React from "react";
import { ButtonIcon, Icon, ConfirmModal } from "@applicator/sdk/components";
import { TodoData, CalendarData, CategoryData } from "@/src/types";

const STATUS_LABELS: Record<string, string> = {
  "needs-action": "To do",
  "in-process": "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "High",
  2: "High",
  3: "High",
  4: "Medium",
  5: "Medium",
  6: "Medium",
  7: "Low",
  8: "Low",
  9: "Low",
};

interface Props {
  todo: TodoData;
  calendar: CalendarData | undefined;
  category?: CategoryData | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  canEdit: boolean;
}

export default function TodoPanel({
  todo,
  calendar,
  category = null,
  onClose,
  onEdit,
  onDelete,
  onToggleComplete,
  canEdit,
}: Props) {
  const [visible, setVisible] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const color = category?.color || todo?.color || calendar?.color || "#3B82F6";
  const isCompleted = todo.status === "completed";

  function formatDueDate(due: string): string {
    const d = new Date(due);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

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
      {/* Header */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Task Details</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {canEdit && !todo.icsSubscriptionId && (
            <ButtonIcon
              name="edit"
              label="Edit task"
              onClick={onEdit}
              size="sm"
            />
          )}
          {canEdit && !todo.icsSubscriptionId && (
            <ButtonIcon
              name="trash"
              label="Delete task"
              onClick={() => setConfirmDelete(true)}
              size="sm"
              subvariant="danger"
            />
          )}
          <ButtonIcon name="close" label="Close" onClick={onClose} size="sm" />
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "16px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {canEdit && !todo.icsSubscriptionId && (
            <button
              onClick={onToggleComplete}
              title={isCompleted ? "Mark incomplete" : "Mark complete"}
              style={{
                flexShrink: 0,
                marginTop: 3,
                width: 18,
                height: 18,
                borderRadius: 4,
                border: `2px solid ${isCompleted ? color : "#475569"}`,
                background: isCompleted ? color : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              {isCompleted && <Icon name="check" size={12} />}
            </button>
          )}
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                textDecoration: isCompleted ? "line-through" : "none",
                opacity: isCompleted ? 0.6 : 1,
              }}
            >
              {todo.summary}
            </div>
            {calendar && (
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                {calendar.name}
              </div>
            )}
          </div>
        </div>

        {todo.due && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            <span style={{ opacity: 0.5, flexShrink: 0 }}>
              <Icon name="calendar" size={14} />
            </span>
            <span>Due {formatDueDate(todo.due)}</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
          }}
        >
          <span style={{ opacity: 0.5, flexShrink: 0 }}>
            <Icon name="check-circle" size={14} />
          </span>
          <span>{STATUS_LABELS[todo.status] || todo.status}</span>
        </div>

        {todo.priority !== undefined && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span style={{ opacity: 0.5, flexShrink: 0 }}>
              <Icon name="flag" size={14} />
            </span>
            <span>
              {PRIORITY_LABELS[todo.priority] || `Priority ${todo.priority}`}{" "}
              priority
            </span>
          </div>
        )}

        {category ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: category.color,
                flexShrink: 0,
              }}
            />
            <span>{category.name}</span>
          </div>
        ) : todo.icsCategory ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: `2px solid ${color}`,
                flexShrink: 0,
              }}
            />
            <span>{todo.icsCategory}</span>
          </div>
        ) : null}

        {todo.description && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 14,
            }}
          >
            <span style={{ opacity: 0.5, marginTop: 1, flexShrink: 0 }}>
              <Icon name="info" size={14} />
            </span>
            <span style={{ whiteSpace: "pre-wrap" }}>{todo.description}</span>
          </div>
        )}

        {todo.completedAt && (
          <div style={{ fontSize: 12, opacity: 0.5 }}>
            Completed{" "}
            {new Date(todo.completedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete task?"
          message="This task will be permanently deleted."
          confirmText="Delete"
          danger
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
