"use client";

import React from "react";
import { Tooltip, ButtonIcon } from "@applicator/sdk/components";
import { CalendarData } from "@/src/types";

interface Props {
  calendars: CalendarData[];
  selectedCalendarId: string | null;
  onSelectCalendar: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewCalendar: () => void;
}

function CalendarIcon({ calendar }: { calendar: CalendarData }) {
  if (calendar.hasIcon) {
    return (
      <img
        src={`/api/calendars/icons/calendars/${calendar.id}`}
        alt={calendar.name}
        style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover", flexShrink: 0, display: "block" }}
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

export default function CalendarSidebar({
  calendars,
  selectedCalendarId,
  onSelectCalendar,
  collapsed,
  onToggleCollapse,
  onNewCalendar,
}: Props) {
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
          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, letterSpacing: "0.05em", textTransform: "uppercase", color: "#e2e8f0" }}>
            Calendars
          </span>
        )}
        <div style={{ display: "flex", gap: 2 }}>
          {!collapsed && (
            <ButtonIcon name="plus" label="New calendar" onClick={onNewCalendar} size="sm" />
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
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
            <ButtonIcon name="plus" label="New calendar" onClick={onNewCalendar} size="sm" placement="right" />
          </div>
        )}

        {calendars.map((cal) =>
          collapsed ? (
            // Collapsed: centering wrapper outside Tooltip so width: "100%" resolves correctly
            <div key={cal.id} style={{ display: "flex", justifyContent: "center", padding: "3px 0" }}>
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
                    background: selectedCalendarId === cal.id ? "#1e3a5f" : "transparent",
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
            // Expanded: full row with name
            <button
              key={cal.id}
              onClick={() => onSelectCalendar(cal.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "calc(100% - 8px)",
                padding: "6px 12px",
                background: selectedCalendarId === cal.id ? "#1e3a5f" : "transparent",
                border: "none",
                cursor: "pointer",
                borderRadius: 6,
                margin: "1px 4px",
                textAlign: "left",
                transition: "background 0.15s",
              }}
            >
              <CalendarIcon calendar={cal} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: selectedCalendarId === cal.id ? 600 : 400,
                  color: "#e2e8f0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {cal.name}
              </span>
            </button>
          )
        )}

        {calendars.length === 0 && !collapsed && (
          <div style={{ padding: "16px 12px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
            No calendars yet
          </div>
        )}
      </div>
    </div>
  );
}
