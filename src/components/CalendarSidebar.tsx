"use client";

import React from "react";
import {
  Tooltip,
  ButtonIcon,
  Button,
  DynamicInput,
  Modal,
} from "@applicator/sdk/components";
import { CalendarData, CategoryData, IcsSubscriptionData } from "@/src/types";

interface Props {
  calendars: CalendarData[];
  selectedCalendarId: string | null;
  onSelectCalendar: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewCalendar: () => void;
  categories: CategoryData[];
  subscriptions: IcsSubscriptionData[];
  checkedCategoryIds: Set<string>;
  checkedSubIds: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleSub: (id: string) => void;
  onCategoryCreated: (cat: CategoryData) => void;
  onCategoryUpdated: (cat: CategoryData) => void;
  onCategoryDeleted: (id: string, scope: "migrate" | "delete") => void;
  onUnsubscribed: (id: string) => void;
  onSubscriptionSynced?: () => void;
  canEdit: boolean;
}

function CalendarIcon({ calendar }: { calendar: CalendarData }) {
  if (calendar.hasIcon) {
    return (
      <img
        src={`/api/calendars/icons/calendars/${calendar.id}`}
        alt={calendar.name}
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          objectFit: "cover",
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 4,
        background: calendar.color || "#3B82F6",
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {calendar.name.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── Category / Subscription create modal ────────────────────────────────────

function CategoryModal({
  calendarId,
  existing,
  onClose,
  onSaved,
}: {
  calendarId: string;
  existing?: CategoryData;
  onClose: () => void;
  onSaved: (cat: CategoryData) => void;
}) {
  const [name, setName] = React.useState(existing?.name || "");
  const [color, setColor] = React.useState(existing?.color || "#3B82F6");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = existing
        ? `/api/calendars/calendars/${calendarId}/categories/${existing.id}`
        : `/api/calendars/calendars/${calendarId}/categories`;
      const method = existing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error || "Failed to save");
      const cat = await res.json();
      onSaved(cat);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <>
      {error && (
        <div style={{ flex: 1, color: "#EF4444", fontSize: 13 }}>{error}</div>
      )}
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave} disabled={saving}>
        {existing ? "Save" : "Create"}
      </Button>
    </>
  );

  return (
    <Modal
      header={existing ? "Edit Category" : "New Category"}
      closeable
      onClose={onClose}
      maxWidth={400}
      footer={footer}
    >
      <div
        style={{
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <DynamicInput
          input={{
            id: "name",
            label: "Name",
            type: "text",
            required: true,
            placeholder: "Category name",
          }}
          value={name}
          onChange={(_, v) => setName(v)}
        />
        <DynamicInput
          input={{ id: "color", label: "Color", type: "color" }}
          value={color}
          onChange={(_, v) => setColor(v)}
        />
      </div>
    </Modal>
  );
}

// ─── Delete category modal ────────────────────────────────────────────────────

function DeleteCategoryModal({
  category,
  onClose,
  onConfirm,
}: {
  category: CategoryData;
  onClose: () => void;
  onConfirm: (scope: "migrate" | "delete") => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 10,
          padding: 24,
          maxWidth: 380,
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
          Delete "{category.name}"?
        </div>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 20 }}>
          What should happen to events in this category?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onConfirm("migrate")}
          >
            Remove category only (keep events)
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={() => onConfirm("delete")}
          >
            Delete category and all its events
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export default function CalendarSidebar({
  calendars,
  selectedCalendarId,
  onSelectCalendar,
  collapsed,
  onToggleCollapse,
  onNewCalendar,
  categories,
  subscriptions,
  checkedCategoryIds,
  checkedSubIds,
  onToggleCategory,
  onToggleSub,
  onCategoryCreated,
  onCategoryUpdated,
  onCategoryDeleted,
  onUnsubscribed,
  onSubscriptionSynced,
  canEdit,
}: Props) {
  const [syncingIds, setSyncingIds] = React.useState<Set<string>>(new Set());
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<
    CategoryData | undefined
  >(undefined);
  const [deletingCategory, setDeletingCategory] =
    React.useState<CategoryData | null>(null);
  const [hoveredItemId, setHoveredItemId] = React.useState<string | null>(null);

  // Sorted categories + subscriptions merged alphabetically for display
  const sortedCategories = [...categories].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const sortedSubs = [...subscriptions].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  type CatItem =
    | { kind: "category"; data: CategoryData }
    | { kind: "sub"; data: IcsSubscriptionData };

  const allItems: CatItem[] = [
    ...sortedCategories.map((c) => ({ kind: "category" as const, data: c })),
    ...sortedSubs.map((s) => ({ kind: "sub" as const, data: s })),
  ].sort((a, b) => a.data.name.localeCompare(b.data.name));

  function handleDeleteConfirm(scope: "migrate" | "delete") {
    if (!deletingCategory) return;
    onCategoryDeleted(deletingCategory.id, scope);
    setDeletingCategory(null);
  }

  async function handleUnsubscribe(sub: IcsSubscriptionData) {
    try {
      const res = await fetch(
        `/api/calendars/calendars/${sub.calendarId}/subscriptions/${sub.id}`,
        { method: "DELETE" },
      );
      if (!res.ok)
        throw new Error((await res.json()).error || "Failed to unsubscribe");
      onUnsubscribed(sub.id);
    } catch {
      // silently ignore — Calendar.tsx will handle error toasts
    }
  }

  async function handleSync(sub: IcsSubscriptionData) {
    setSyncingIds((prev) => new Set([...prev, sub.id]));
    try {
      await fetch(`/api/calendars/calendars/${sub.calendarId}/subscriptions/${sub.id}/sync`, { method: "POST" });
      onSubscriptionSynced?.();
    } finally {
      setSyncingIds((prev) => { const s = new Set(prev); s.delete(sub.id); return s; });
    }
  }

  const colorDot = (color: string) => (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );

  return (
    <div
      style={{
        width: collapsed ? 44 : 220,
        minWidth: collapsed ? 44 : 220,
        background: "#1e293b",
        borderRight: "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s, min-width 0.2s",
        overflow: "hidden",
      }}
    >
      {/* Calendars header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: collapsed ? "10px 0" : "10px 12px",
          borderBottom: "1px solid #334155",
          gap: 6,
        }}
      >
        {!collapsed && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              opacity: 0.7,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#e2e8f0",
            }}
          >
            Calendars
          </span>
        )}
        <div style={{ display: "flex", gap: 2 }}>
          {!collapsed && (
            <ButtonIcon
              name="plus"
              label="New calendar"
              onClick={onNewCalendar}
              size="sm"
            />
          )}
          <ButtonIcon
            name={collapsed ? "chevron-right" : "chevron-left"}
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
            size="sm"
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {collapsed && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "4px 0 8px",
            }}
          >
            <ButtonIcon
              name="plus"
              label="New calendar"
              onClick={onNewCalendar}
              size="sm"
              placement="right"
            />
          </div>
        )}

        {/* Calendar list */}
        {calendars.map((cal) =>
          collapsed ? (
            <div
              key={cal.id}
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "3px 0",
              }}
            >
              <Tooltip text={cal.name} placement="right">
                <button
                  onClick={() => onSelectCalendar(cal.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background:
                      selectedCalendarId === cal.id ? "#1e3a5f" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "background 0.15s",
                  }}
                >
                  <CalendarIcon calendar={cal} />
                </button>
              </Tooltip>
            </div>
          ) : (
            <button
              key={cal.id}
              onClick={() => onSelectCalendar(cal.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "calc(100% - 8px)",
                padding: "6px 12px",
                background:
                  selectedCalendarId === cal.id ? "#1e3a5f" : "transparent",
                border: "none",
                cursor: "pointer",
                borderRadius: 6,
                margin: "1px 4px",
                textAlign: "left",
                transition: "background 0.15s",
              }}
            >
              <CalendarIcon calendar={cal} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: selectedCalendarId === cal.id ? 600 : 400,
                    color: "#e2e8f0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cal.name}
                </div>
                {cal.description && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginTop: 1,
                    }}
                  >
                    {cal.description}
                  </div>
                )}
              </div>
            </button>
          ),
        )}

        {calendars.length === 0 && !collapsed && (
          <div
            style={{
              padding: "16px 12px",
              fontSize: 13,
              color: "#94a3b8",
              textAlign: "center",
            }}
          >
            No calendars yet
          </div>
        )}

        {/* Categories section — only shown expanded and when a calendar is selected */}
        {!collapsed && allItems.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 12px 4px",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  opacity: 0.7,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "#e2e8f0",
                }}
              >
                Categories
              </span>
              {canEdit && (
                <ButtonIcon
                  name="plus"
                  label="New category"
                  size="sm"
                  placement="right"
                  onClick={() => {
                    setEditingCategory(undefined);
                    setShowCategoryModal(true);
                  }}
                />
              )}
            </div>

            {allItems.map((item) => {
              const id = item.data.id;
              const isChecked =
                item.kind === "category"
                  ? checkedCategoryIds.has(id)
                  : checkedSubIds.has(id);
              const color = item.data.color || "#3B82F6";
              const isHovered = hoveredItemId === id;

              return (
                <div
                  key={id}
                  onMouseEnter={() => setHoveredItemId(id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 8px 4px 12px",
                    borderRadius: 6,
                    margin: "1px 4px",
                    cursor: "default",
                    transition: "background 0.1s",
                    background: isHovered ? "#243044" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      item.kind === "category"
                        ? onToggleCategory(id)
                        : onToggleSub(id)
                    }
                    style={{
                      accentColor: color,
                      width: 14,
                      height: 14,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                  {colorDot(color)}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: "#e2e8f0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      opacity: isChecked ? 1 : 0.5,
                    }}
                  >
                    {item.data.name}
                    {item.kind === "sub" && (
                      <span
                        style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}
                      >
                        ICS
                      </span>
                    )}
                  </span>

                  {/* Hover-only action buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: 1,
                      opacity: isHovered ? 1 : 0,
                      transition: "opacity 0.1s",
                      flexShrink: 0,
                    }}
                  >
                    {item.kind === "category" && canEdit && (
                      <ButtonIcon
                        name="edit"
                        label="Edit category"
                        size="sm"
                        onClick={() => {
                          setEditingCategory(item.data as CategoryData);
                          setShowCategoryModal(true);
                        }}
                      />
                    )}
                    {item.kind === "category" && canEdit && (
                      <ButtonIcon
                        name="trash"
                        label="Delete category"
                        size="sm"
                        subvariant="danger"
                        onClick={() =>
                          setDeletingCategory(item.data as CategoryData)
                        }
                      />
                    )}
                    {item.kind === "sub" && canEdit && (
                      <ButtonIcon
                        name="refresh"
                        label="Sync now"
                        size="sm"
                        placement="bottom"
                        disabled={syncingIds.has(id)}
                        onClick={() => handleSync(item.data as IcsSubscriptionData)}
                      />
                    )}
                    {item.kind === "sub" && canEdit && (
                      <ButtonIcon
                        name="close"
                        label="Unsubscribe"
                        size="sm"
                        subvariant="danger"
                        placement="bottom"
                        onClick={() =>
                          handleUnsubscribe(item.data as IcsSubscriptionData)
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Show "Categories" header + add button even when list is empty */}
        {!collapsed && allItems.length === 0 && canEdit && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 12px 4px",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                opacity: 0.7,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "#e2e8f0",
              }}
            >
              Categories
            </span>
            <ButtonIcon
              name="plus"
              label="New category"
              size="sm"
              placement="bottom"
              onClick={() => {
                setEditingCategory(undefined);
                setShowCategoryModal(true);
              }}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCategoryModal && (
        <CategoryModal
          calendarId={selectedCalendarId!}
          existing={editingCategory}
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(undefined);
          }}
          onSaved={(cat) => {
            setShowCategoryModal(false);
            setEditingCategory(undefined);
            if (editingCategory) {
              onCategoryUpdated(cat);
            } else {
              onCategoryCreated(cat);
            }
          }}
        />
      )}

      {deletingCategory && (
        <DeleteCategoryModal
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
