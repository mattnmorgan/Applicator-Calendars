"use client";

import React from "react";
import { Modal, Button, ButtonIcon, Spinner, DynamicInput } from "@applicator/sdk/components";
import { CalendarData, ShareData, UserData } from "@/src/types";

interface Props {
  calendar: CalendarData;
  onClose: () => void;
  onSaved: (updates: Partial<CalendarData>) => void;
}

const VIEW_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "3days", label: "Next 3 Days" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "agenda", label: "Agenda" },
];

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 14,
  background: "#0f172a",
  color: "#f1f5f9",
};

const SELECT_STYLE: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 14,
  background: "#0f172a",
  color: "#f1f5f9",
};

// ─── Details tab content ─────────────────────────────────────────────────────

interface DetailsContentProps {
  calendar: CalendarData;
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  color: string; setColor: (v: string) => void;
  defaultView: string; setDefaultView: (v: string) => void;
  iconFile: File | null; setIconFile: (f: File | null) => void;
  hasIcon: boolean; setHasIcon: (v: boolean) => void;
  removeIcon: boolean; setRemoveIcon: (v: boolean) => void;
}

function DetailsContent({
  calendar, name, setName, description, setDescription,
  color, setColor, defaultView, setDefaultView,
  iconFile, setIconFile, hasIcon, setHasIcon, removeIcon, setRemoveIcon,
}: DetailsContentProps) {
  const [copied, setCopied] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const showingIcon = !removeIcon && (hasIcon || iconFile);

  function copyId() {
    navigator.clipboard.writeText(calendar.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Name | Color | Default View — all on one row */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <div style={{ flex: 2 }}>
          <DynamicInput
            input={{ id: "name", label: "Name", type: "text", required: true }}
            value={name}
            onChange={(_, v) => setName(v)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <DynamicInput
            input={{ id: "color", label: "Color", type: "color" }}
            value={color}
            onChange={(_, v) => setColor(v)}
          />
        </div>
        <div style={{ flex: 2 }}>
          <DynamicInput
            input={{ id: "defaultView", label: "Default View", type: "select", options: VIEW_OPTIONS }}
            value={defaultView}
            onChange={(_, v) => setDefaultView(v)}
          />
        </div>
      </div>

      <DynamicInput
        input={{ id: "description", label: "Description", type: "text", lines: 2, resizable: true }}
        value={description}
        onChange={(_, v) => setDescription(v)}
      />

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#e2e8f0" }}>Icon</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {showingIcon && (
            <img
              src={iconFile ? URL.createObjectURL(iconFile) : `/api/calendars/icons/calendars/${calendar.id}`}
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }}
            />
          )}
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {showingIcon ? "Change icon" : "Upload icon"}
          </Button>
          {showingIcon && (
            <ButtonIcon
              name="close"
              label="Remove icon"
              size="sm"
              onClick={() => { setRemoveIcon(true); setIconFile(null); setHasIcon(false); }}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setIconFile(f);
              if (f) setRemoveIcon(false);
            }}
          />
          {iconFile && <span style={{ fontSize: 13, color: "#94a3b8" }}>{iconFile.name}</span>}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #334155", paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" }}>Calendar ID</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <code style={{ fontSize: 12, background: "#0f172a", color: "#94a3b8", padding: "4px 8px", borderRadius: 4, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {calendar.id}
          </code>
          <ButtonIcon name="copy" label={copied ? "Copied!" : "Copy ID"} onClick={copyId} size="sm" />
        </div>
      </div>
    </div>
  );
}

// ─── Share tab ───────────────────────────────────────────────────────────────

function ShareTab({ calendar }: { calendar: CalendarData }) {
  const [shares, setShares] = React.useState<ShareData[]>([]);
  const [users, setUsers] = React.useState<UserData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState<UserData | null>(null);
  const [selectedRole, setSelectedRole] = React.useState<"viewer" | "editor" | "admin">("viewer");
  const [saving, setSaving] = React.useState(false);
  const [transferring, setTransferring] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [transferDone, setTransferDone] = React.useState(false);

  const canManage = calendar.role === "owner" || calendar.role === "admin";

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/calendars/calendars/${calendar.id}/shares`).then((r) => r.json()),
      fetch(`/api/calendars/users`).then((r) => r.json()),
    ])
      .then(([sharesData, usersData]) => {
        setShares(sharesData.shares || []);
        setUsers(usersData.users || []);
      })
      .finally(() => setLoading(false));
  }, [calendar.id]);

  const filteredUsers = users.filter(
    (u) =>
      !shares.find((s) => s.userId === u.id) &&
      u.id !== calendar.ownerId &&
      (!query || u.displayName.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()))
  );

  async function handleAdd() {
    if (!selectedUser) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/calendars/calendars/${calendar.id}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, role: selectedRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to share");
      const share = await res.json();
      setShares((prev) => [...prev, share]);
      setSelectedUser(null);
      setQuery("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(shareId: string) {
    try {
      await fetch(`/api/calendars/calendars/${calendar.id}/shares/${shareId}`, { method: "DELETE" });
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleRoleChange(share: ShareData, newRole: "viewer" | "editor" | "admin") {
    try {
      await fetch(`/api/calendars/calendars/${calendar.id}/shares/${share.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      setShares((prev) => prev.map((s) => (s.id === share.id ? { ...s, role: newRole } : s)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleTransfer(userId: string) {
    setTransferring(userId);
    setError("");
    try {
      const res = await fetch(`/api/calendars/calendars/${calendar.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Transfer failed");
      setTransferDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTransferring(null);
    }
  }

  if (loading) return <div style={{ padding: 32, textAlign: "center" }}><Spinner /></div>;

  if (transferDone) return (
    <div style={{ padding: 16, background: "rgba(16,185,129,0.1)", borderRadius: 6, fontSize: 14, color: "#34d399" }}>
      Ownership transferred. You now have admin access.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {canManage && (
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#e2e8f0" }}>Add user</label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedUser(null); }}
                placeholder="Search users..."
                style={INPUT_STYLE}
              />
              {query && !selectedUser && filteredUsers.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.4)", zIndex: 50, maxHeight: 200, overflowY: "auto" }}>
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setQuery(u.displayName); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", color: "#e2e8f0", cursor: "pointer", textAlign: "left", fontSize: 14 }}
                    >
                      {u.profilePicture ? <img src={u.profilePicture} style={{ width: 24, height: 24, borderRadius: "50%" }} /> : <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700 }}>{u.displayName.charAt(0)}</div>}
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.displayName}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>@{u.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as any)} style={SELECT_STYLE}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <Button variant="primary" onClick={handleAdd} disabled={saving || !selectedUser}>Add</Button>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" }}>Shared with</div>
        {shares.length === 0 ? (
          <div style={{ fontSize: 13, color: "#94a3b8", padding: "8px 0" }}>Not shared with anyone</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shares.map((share) => (
              <div key={share.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {share.profilePicture ? <img src={share.profilePicture} style={{ width: 32, height: 32, borderRadius: "50%" }} /> : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 700 }}>{share.displayName.charAt(0)}</div>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>{share.displayName}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>@{share.username}</div>
                </div>
                {canManage ? (
                  <>
                    <select value={share.role} onChange={(e) => handleRoleChange(share, e.target.value as any)} style={{ ...SELECT_STYLE, padding: "4px 8px", fontSize: 13 }}>
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    {calendar.role === "owner" && (
                      <ButtonIcon
                        name="crown"
                        label="Transfer ownership"
                        onClick={() => handleTransfer(share.userId)}
                        size="sm"
                        disabled={transferring === share.userId}
                      />
                    )}
                    <ButtonIcon name="trash" label="Remove" onClick={() => handleRemove(share.id)} size="sm" subvariant="danger" />
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: "#94a3b8", textTransform: "capitalize" }}>{share.role}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
    </div>
  );
}

// ─── Subscriptions tab ───────────────────────────────────────────────────────

interface IcsSub {
  id: string;
  name: string;
  url: string;
  color: string;
  lastSynced: string | null;
}

function SubscriptionsTab({ calendar }: { calendar: CalendarData }) {
  const canEdit = ["owner", "admin", "editor"].includes(calendar.role);
  const canDelete = ["owner", "admin"].includes(calendar.role);
  const [subs, setSubs] = React.useState<IcsSub[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newName, setNewName] = React.useState("");
  const [newUrl, setNewUrl] = React.useState("");
  const [newColor, setNewColor] = React.useState(calendar.color || "#3B82F6");
  const [adding, setAdding] = React.useState(false);
  const [syncing, setSyncing] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    fetch(`/api/calendars/calendars/${calendar.id}/subscriptions`)
      .then((r) => r.json())
      .then((d) => setSubs(d.subscriptions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [calendar.id]);

  async function handleAdd() {
    if (!newName.trim() || !newUrl.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/calendars/calendars/${calendar.id}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), url: newUrl.trim(), color: newColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add");
      setSubs((prev) => [...prev, data]);
      setNewName("");
      setNewUrl("");
      if (data.syncError) setError(`Added, but initial sync failed: ${data.syncError}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleSync(sub: IcsSub) {
    setSyncing(sub.id);
    setError("");
    try {
      const res = await fetch(
        `/api/calendars/calendars/${calendar.id}/subscriptions/${sub.id}/sync`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Sync failed");
      setSubs((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, lastSynced: new Date().toISOString() } : s))
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(null);
    }
  }

  async function handleDelete(subId: string) {
    setError("");
    try {
      const res = await fetch(
        `/api/calendars/calendars/${calendar.id}/subscriptions/${subId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      setSubs((prev) => prev.filter((s) => s.id !== subId));
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) return <div style={{ padding: 32, textAlign: "center" }}><Spinner /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {canEdit && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" }}>Add subscription</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                style={{ ...INPUT_STYLE, flex: 1 }}
              />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                title="Subscription color"
                style={{ width: 42, height: 38, border: "1px solid #334155", borderRadius: 6, background: "#0f172a", cursor: "pointer", padding: 2, flexShrink: 0 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/calendar.ics"
                style={{ ...INPUT_STYLE, flex: 1 }}
              />
              <Button
                variant="primary"
                onClick={handleAdd}
                disabled={adding || !newName.trim() || !newUrl.trim()}
              >
                {adding ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div>
        {subs.length === 0 ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>No subscriptions yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {subs.map((sub) => (
              <div
                key={sub.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155" }}
              >
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: sub.color, flexShrink: 0, display: "inline-block" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>{sub.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.url}</div>
                  {sub.lastSynced && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                      Synced {new Date(sub.lastSynced).toLocaleString()}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <ButtonIcon
                    name="refresh"
                    label="Sync now"
                    onClick={() => handleSync(sub)}
                    size="sm"
                    disabled={syncing === sub.id}
                  />
                )}
                {canDelete && (
                  <ButtonIcon name="trash" label="Delete" onClick={() => handleDelete(sub.id)} size="sm" subvariant="danger" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
    </div>
  );
}

// ─── Export tab ───────────────────────────────────────────────────────────────

function ExportTab({ calendar }: { calendar: CalendarData }) {
  const icsUrl = `${window.location.origin}/api/calendars/calendars/${calendar.id}/ics`;
  const exportUrl = `/api/calendars/calendars/${calendar.id}/export`;
  const subUrl = `${window.location.origin}/api/calendars/ics/${calendar.icsToken}`;
  const [copiedSub, setCopiedSub] = React.useState(false);

  function copySub() {
    navigator.clipboard.writeText(subUrl).then(() => {
      setCopiedSub(true);
      setTimeout(() => setCopiedSub(false), 2000);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" }}>Download ICS file</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, fontSize: 13, color: "#94a3b8" }}>
            Export all events as an ICS file to import into Google Calendar, Outlook, Apple Calendar, or any other calendar app.
          </div>
          <a
            href={icsUrl}
            download={`${calendar.name}.ics`}
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#3B82F6", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Download ICS
          </a>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #334155", paddingTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" }}>Export as JSON</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, fontSize: 13, color: "#94a3b8" }}>
            Export calendar data (events, subscriptions, icon) as a JSON file for backup or re-import.
          </div>
          <a
            href={exportUrl}
            download={`${calendar.name}_export.json`}
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#475569", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Download JSON
          </a>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #334155", paddingTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: "#e2e8f0" }}>Subscribe URL</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>
          Use this URL in Google Calendar or other apps to subscribe and keep events in sync automatically.
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <code style={{ fontSize: 12, background: "#0f172a", color: "#94a3b8", padding: "6px 8px", borderRadius: 4, flex: 1, wordBreak: "break-all" }}>
            {subUrl}
          </code>
          <ButtonIcon name="copy" label={copiedSub ? "Copied!" : "Copy URL"} onClick={copySub} size="sm" />
        </div>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function CalendarSettingsModal({ calendar, onClose, onSaved }: Props) {
  const [tab, setTab] = React.useState<"details" | "share" | "subscriptions" | "export">("details");

  // Details tab state — lifted here so footer Save button can call handleSave
  const [name, setName] = React.useState(calendar.name);
  const [description, setDescription] = React.useState(calendar.description || "");
  const [color, setColor] = React.useState(calendar.color || "#3B82F6");
  const [defaultView, setDefaultView] = React.useState(calendar.defaultView || "week");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [iconFile, setIconFile] = React.useState<File | null>(null);
  const [hasIcon, setHasIcon] = React.useState(calendar.hasIcon);
  const [removeIcon, setRemoveIcon] = React.useState(false);

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/calendars/calendars/${calendar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, color, defaultView }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");

      if (removeIcon && !iconFile) {
        await fetch(`/api/calendars/icons/calendars/${calendar.id}`, { method: "DELETE" });
      } else if (iconFile) {
        const iconRes = await fetch(`/api/calendars/icons/calendars/${calendar.id}`, {
          method: "POST",
          headers: { "Content-Type": iconFile.type },
          body: iconFile,
        });
        if (!iconRes.ok) throw new Error("Failed to upload icon");
      }

      const newHasIcon = removeIcon && !iconFile ? false : iconFile ? true : calendar.hasIcon;
      onSaved({ name: name.trim(), description, color, defaultView: defaultView as any, hasIcon: newHasIcon });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const tabs = ["details", "share", "subscriptions", "export"] as const;
  const tabLabels: Record<string, string> = { details: "Details", share: "Share", subscriptions: "Subscriptions", export: "Export" };

  const footer = tab === "details" ? (
    <>
      {error && <div style={{ flex: 1, color: "#EF4444", fontSize: 13 }}>{error}</div>}
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={handleSave} disabled={saving}>Save</Button>
    </>
  ) : undefined;

  return (
    <Modal header={`${calendar.name} — Settings`} closeable onClose={onClose} maxWidth={560} footer={footer}>
      {/* Tab bar — flush against the modal header, no outer padding */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #334155" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 18px",
              border: "none",
              borderBottom: tab === t ? "2px solid #3B82F6" : "2px solid transparent",
              background: "transparent",
              color: tab === t ? "#f1f5f9" : "#94a3b8",
              fontSize: 14,
              fontWeight: tab === t ? 600 : 400,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Tab body padding lives here, not on the modal wrapper */}
      <div style={{ padding: 24 }}>
        {tab === "details" && (
          <DetailsContent
            calendar={calendar}
            name={name} setName={setName}
            description={description} setDescription={setDescription}
            color={color} setColor={setColor}
            defaultView={defaultView} setDefaultView={setDefaultView}
            iconFile={iconFile} setIconFile={setIconFile}
            hasIcon={hasIcon} setHasIcon={setHasIcon}
            removeIcon={removeIcon} setRemoveIcon={setRemoveIcon}
          />
        )}
        {tab === "share" && <ShareTab calendar={calendar} />}
        {tab === "subscriptions" && <SubscriptionsTab calendar={calendar} />}
        {tab === "export" && <ExportTab calendar={calendar} />}
      </div>
    </Modal>
  );
}
