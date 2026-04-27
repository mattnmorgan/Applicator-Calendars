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

function DetailsTab({ calendar, onSaved, onClose }: { calendar: CalendarData; onSaved: (u: Partial<CalendarData>) => void; onClose: () => void }) {
  const [name, setName] = React.useState(calendar.name);
  const [description, setDescription] = React.useState(calendar.description || "");
  const [color, setColor] = React.useState(calendar.color || "#3B82F6");
  const [defaultView, setDefaultView] = React.useState(calendar.defaultView || "week");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [iconFile, setIconFile] = React.useState<File | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [copiedIcs, setCopiedIcs] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const icsUrl = `${window.location.origin}/api/calendars/ics/${calendar.icsToken}`;

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

      if (iconFile) {
        const iconRes = await fetch(`/api/calendars/icons/calendars/${calendar.id}`, {
          method: "POST",
          headers: { "Content-Type": iconFile.type },
          body: iconFile,
        });
        if (!iconRes.ok) throw new Error("Failed to upload icon");
      }

      onSaved({ name: name.trim(), description, color, defaultView: defaultView as any, hasIcon: iconFile ? true : calendar.hasIcon });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function copyId() {
    navigator.clipboard.writeText(calendar.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyIcs() {
    navigator.clipboard.writeText(icsUrl).then(() => {
      setCopiedIcs(true);
      setTimeout(() => setCopiedIcs(false), 2000);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <DynamicInput
        input={{ id: "name", label: "Name", type: "text", required: true }}
        value={name}
        onChange={(_, v) => setName(v)}
      />

      <DynamicInput
        input={{ id: "description", label: "Description", type: "text", lines: 2, resizable: true }}
        value={description}
        onChange={(_, v) => setDescription(v)}
      />

      <DynamicInput
        input={{ id: "color", label: "Color", type: "color" }}
        value={color}
        onChange={(_, v) => setColor(v)}
      />

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#e2e8f0" }}>Icon</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(calendar.hasIcon || iconFile) && (
            <img
              src={iconFile ? URL.createObjectURL(iconFile) : `/api/calendars/icons/calendars/${calendar.id}`}
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }}
            />
          )}
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {calendar.hasIcon || iconFile ? "Change icon" : "Upload icon"}
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setIconFile(e.target.files?.[0] || null)} />
          {iconFile && <span style={{ fontSize: 13, color: "#94a3b8" }}>{iconFile.name}</span>}
        </div>
      </div>

      <DynamicInput
        input={{ id: "defaultView", label: "Default View", type: "select", options: VIEW_OPTIONS }}
        value={defaultView}
        onChange={(_, v) => setDefaultView(v)}
      />

      <div style={{ borderTop: "1px solid #334155", paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" }}>Calendar ID</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <code style={{ fontSize: 12, background: "#0f172a", color: "#94a3b8", padding: "4px 8px", borderRadius: 4, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {calendar.id}
          </code>
          <ButtonIcon name="copy" label={copied ? "Copied!" : "Copy ID"} onClick={copyId} size="sm" />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" }}>ICS URL</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <code style={{ fontSize: 12, background: "#0f172a", color: "#94a3b8", padding: "4px 8px", borderRadius: 4, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {icsUrl}
          </code>
          <ButtonIcon name="copy" label={copiedIcs ? "Copied!" : "Copy ICS URL"} onClick={copyIcs} size="sm" />
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Use this URL in Google Calendar or other apps to subscribe to this calendar.</div>
      </div>

      {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>Save</Button>
      </div>
    </div>
  );
}

function ShareTab({ calendar }: { calendar: CalendarData }) {
  const [shares, setShares] = React.useState<ShareData[]>([]);
  const [users, setUsers] = React.useState<UserData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState<UserData | null>(null);
  const [selectedRole, setSelectedRole] = React.useState<"viewer" | "editor" | "admin">("viewer");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

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

  if (loading) return <div style={{ padding: 32, textAlign: "center" }}><Spinner /></div>;

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

      {calendar.role === "owner" && (
        <TransferOwnership calendar={calendar} />
      )}

      {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
    </div>
  );
}

function TransferOwnership({ calendar }: { calendar: CalendarData }) {
  const [users, setUsers] = React.useState<UserData[]>([]);
  const [query, setQuery] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState<UserData | null>(null);
  const [transferring, setTransferring] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/calendars/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []));
  }, []);

  const filtered = users.filter((u) => !query || u.displayName.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()));

  async function handleTransfer() {
    if (!selectedUser) return;
    setTransferring(true);
    setError("");
    try {
      const res = await fetch(`/api/calendars/calendars/${calendar.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: selectedUser.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Transfer failed");
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTransferring(false);
    }
  }

  if (done) return (
    <div style={{ padding: 12, background: "rgba(16,185,129,0.1)", borderRadius: 6, fontSize: 14, color: "#34d399" }}>
      Ownership transferred. You now have admin access.
    </div>
  );

  return (
    <div style={{ borderTop: "1px solid #334155", paddingTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#e2e8f0" }}>Transfer Ownership</div>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>
        Transfer this calendar to another user. You will retain admin access.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedUser(null); }}
            placeholder="Search users..."
            style={INPUT_STYLE}
          />
          {query && !selectedUser && filtered.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.4)", zIndex: 50, maxHeight: 160, overflowY: "auto" }}>
              {filtered.map((u) => (
                <button key={u.id} onClick={() => { setSelectedUser(u); setQuery(u.displayName); }} style={{ display: "block", width: "100%", padding: "8px 12px", border: "none", background: "transparent", color: "#e2e8f0", cursor: "pointer", textAlign: "left", fontSize: 14 }}>
                  {u.displayName} <span style={{ color: "#94a3b8" }}>(@{u.username})</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="danger" onClick={handleTransfer} disabled={transferring || !selectedUser}>Transfer</Button>
      </div>
      {error && <div style={{ color: "#EF4444", fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export default function CalendarSettingsModal({ calendar, onClose, onSaved }: Props) {
  const [tab, setTab] = React.useState("details");

  const tabs = ["details", "share"] as const;
  const tabLabels: Record<string, string> = { details: "Details", share: "Share" };

  return (
    <Modal header={`${calendar.name} — Settings`} closeable onClose={onClose} maxWidth={560}>
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #334155", marginBottom: 16 }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
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
        <div>
          {tab === "details" && <DetailsTab calendar={calendar} onSaved={onSaved} onClose={onClose} />}
          {tab === "share" && <ShareTab calendar={calendar} />}
        </div>
      </div>
    </Modal>
  );
}
