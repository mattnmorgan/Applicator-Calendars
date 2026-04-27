import { ApiContext } from "@applicator/sdk/context";
import { CalendarRecord, CalendarRole } from "@/src/types";

function calendarRecordId(calendarId: string): string {
  return `calendar-${calendarId}`;
}

export function sharePermission(role: "viewer" | "editor" | "admin"): string {
  return `calendars:calendar-${role}`;
}

export async function getCalendarAccess(
  context: ApiContext,
  calendarId: string
): Promise<{ level: CalendarRole; userId: string; calendar: { id: string; data: CalendarRecord } } | null> {
  const user = await context.user();
  if (!user) return null;

  const mgr = context.recordManager<CalendarRecord>("calendars", "calendar");
  const calendar = await mgr.readRecord(calendarId);
  if (!calendar) return null;

  if ((calendar.data as any).ownerId === user.id) {
    return { level: "owner", userId: user.id, calendar: calendar as { id: string; data: CalendarRecord } };
  }

  const caManager = (context as any).contextualAuthorityManager;
  const cas = await caManager.getContextualAuthorities("calendars", calendarRecordId(calendarId));
  const userCA = cas.find((ca: any) => ca.data.user === user.id);

  if (userCA) {
    const ctx = userCA.data.context ? JSON.parse(userCA.data.context) : {};
    return {
      level: ctx.role as "admin" | "editor" | "viewer",
      userId: user.id,
      calendar: calendar as { id: string; data: CalendarRecord },
    };
  }

  return null;
}

export async function createCalendarShare(
  context: ApiContext,
  calendarId: string,
  userId: string,
  role: "viewer" | "editor" | "admin",
  createdBy: string
) {
  const caManager = (context as any).contextualAuthorityManager;
  return caManager.createUserContextualAuthority({
    app: "calendars",
    recordId: calendarRecordId(calendarId),
    permission: sharePermission(role),
    user: userId,
    createdBy,
    context: JSON.stringify({ role }),
  });
}

export async function updateCalendarShare(
  context: ApiContext,
  shareId: string,
  calendarId: string,
  userId: string,
  role: "viewer" | "editor" | "admin",
  createdBy: string
) {
  const caManager = (context as any).contextualAuthorityManager;
  await caManager.deleteContextualAuthority(shareId);
  return caManager.createUserContextualAuthority({
    app: "calendars",
    recordId: calendarRecordId(calendarId),
    permission: sharePermission(role),
    user: userId,
    createdBy,
    context: JSON.stringify({ role }),
  });
}

export async function listCalendarShares(context: ApiContext, calendarId: string) {
  const caManager = (context as any).contextualAuthorityManager;
  return caManager.getContextualAuthorities("calendars", calendarRecordId(calendarId));
}

export async function deleteAllCalendarShares(context: ApiContext, calendarId: string) {
  const cas = await listCalendarShares(context, calendarId);
  const caManager = (context as any).contextualAuthorityManager;
  await Promise.all(cas.map((ca: any) => caManager.deleteContextualAuthority(ca.id)));
}

export async function deleteCalendarShare(context: ApiContext, shareId: string) {
  const caManager = (context as any).contextualAuthorityManager;
  return caManager.deleteContextualAuthority(shareId);
}
