"use client";

import React from "react";
import { ButtonIcon, Icon, Button, ConfirmModal } from "@applicator/sdk/components";
import { datetime } from "@applicator/sdk/utilities";
import { EventOccurrence, CalendarData } from "@/src/types";

const { formatDatetime } = datetime;

interface Props {
  event: EventOccurrence;
  calendar: CalendarData | undefined;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (scope: "one" | "following" | "all") => void;
  canEdit: boolean;
}

type DeleteScope = "one" | "following" | "all";

function statusLabel(s: string): string {
  if (s === "busy") return "Busy";
  if (s === "ooo") return "Out of Office";
  return "Free";
}

export default function EventPanel({ event, calendar, onClose, onEdit, onDelete, canEdit }: Props) {
  const [confirmDeleteScope, setConfirmDeleteScope] = React.useState<DeleteScope | null>(null);
  const [showDeleteScopeMenu, setShowDeleteScopeMenu] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  // Trigger slide-in on mount
  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const color = event.color || calendar?.color || "#3B82F6";

  function handleDeleteClick() {
    if (event.isRecurring) {
      setShowDeleteScopeMenu(true);
    } else {
      setConfirmDelete(true);
    }
  }

  function handleScopeSelect(scope: DeleteScope) {
    setShowDeleteScopeMenu(false);
    setConfirmDeleteScope(scope);
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
          <span style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Event Details
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {canEdit && <ButtonIcon name="edit" label="Edit event" onClick={onEdit} size="sm" />}
          {canEdit && <ButtonIcon name="trash" label="Delete event" onClick={handleDeleteClick} size="sm" subvariant="danger" />}
          <ButtonIcon name="close" label="Close" onClick={onClose} size="sm" />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{event.name}</div>
          {calendar && (
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{calendar.name}</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14 }}>
          <span style={{ opacity: 0.5, marginTop: 1, flexShrink: 0 }}>
            <Icon name="calendar" size={14} />
          </span>
          <div>
            {event.allDay ? (
              <span>{formatDatetime(event.occurrenceStart, true)}{" (All day)"}</span>
            ) : (
              <div>
                <div>{formatDatetime(event.occurrenceStart, false)}</div>
                <div style={{ opacity: 0.7 }}>→ {formatDatetime(event.occurrenceEnd, false)}</div>
              </div>
            )}
          </div>
        </div>

        {event.location && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14 }}>
            <span style={{ opacity: 0.5, marginTop: 1, flexShrink: 0 }}>
              <Icon name="pin" size={14} />
            </span>
            <span>{event.location}</span>
          </div>
        )}

        {event.description && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14 }}>
            <span style={{ opacity: 0.5, marginTop: 1, flexShrink: 0 }}>
              <Icon name="info" size={14} />
            </span>
            <span style={{ whiteSpace: "pre-wrap" }}>{event.description}</span>
          </div>
        )}

        {event.status && event.status !== "free" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ opacity: 0.5, flexShrink: 0 }}>
              <Icon name="user" size={14} />
            </span>
            <span>{statusLabel(event.status)}</span>
          </div>
        )}

        {event.isRecurring && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ opacity: 0.5, flexShrink: 0 }}>
              <Icon name="refresh" size={14} />
            </span>
            <span>Recurring event</span>
          </div>
        )}
      </div>

      {/* Delete scope menu */}
      {showDeleteScopeMenu && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowDeleteScopeMenu(false)}
        >
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: 20,
              maxWidth: 300,
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Delete recurring event</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
              Which occurrences do you want to delete?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button variant="secondary" fullWidth onClick={() => handleScopeSelect("one")}>This event only</Button>
              <Button variant="secondary" fullWidth onClick={() => handleScopeSelect("following")}>This and following events</Button>
              <Button variant="danger" fullWidth onClick={() => handleScopeSelect("all")}>All events in series</Button>
              <Button variant="secondary" fullWidth onClick={() => setShowDeleteScopeMenu(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteScope && (
        <ConfirmModal
          title={confirmDeleteScope === "all" ? "Delete all events in series?" : "Delete event?"}
          message={
            confirmDeleteScope === "one"
              ? "This occurrence will be removed."
              : confirmDeleteScope === "following"
              ? "This and all following occurrences will be removed."
              : "All occurrences in this series will be permanently deleted."
          }
          confirmText="Delete"
          danger
          onConfirm={() => { setConfirmDeleteScope(null); onDelete(confirmDeleteScope!); }}
          onCancel={() => setConfirmDeleteScope(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete event?"
          message="This event will be permanently deleted."
          confirmText="Delete"
          danger
          onConfirm={() => { setConfirmDelete(false); onDelete("all"); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
