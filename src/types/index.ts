export type ViewMode = "today" | "3days" | "week" | "month" | "agenda";
export type CalendarRole = "owner" | "admin" | "editor" | "viewer";
export type EventStatus = "free" | "busy" | "ooo";

export interface CalendarRecord {
  name: string;
  description?: string;
  color?: string;
  hasIcon?: boolean;
  iconData?: string;
  defaultView?: ViewMode;
  ownerId: string;
  icsToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarData {
  id: string;
  name: string;
  description?: string;
  color?: string;
  hasIcon: boolean;
  defaultView: ViewMode;
  ownerId: string;
  icsToken: string;
  role: CalendarRole;
}

export interface RecurrenceRule {
  type: "weekly" | "interval";
  days?: number[];
  interval?: number;
  unit?: "day" | "week" | "month" | "year";
  endDate?: string;
}

export interface EventRecord {
  calendarId: string;
  name: string;
  description?: string;
  location?: string;
  color?: string;
  allDay?: boolean;
  status?: EventStatus;
  startDate: string;
  endDate: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  seriesId?: string;
  exceptionDate?: string;
  isException?: boolean;
  deletedOccurrences?: string;
  icsSubscriptionId?: string;
  icsUid?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IcsSubscriptionRecord {
  calendarId: string;
  name: string;
  url: string;
  color?: string;
  ownerId: string;
  lastSynced?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IcsSubscriptionData {
  id: string;
  calendarId: string;
  name: string;
  url: string;
  color: string;
  ownerId: string;
  lastSynced: string | null;
  createdAt: string;
}

export interface EventData {
  id: string;
  calendarId: string;
  name: string;
  description?: string;
  location?: string;
  color?: string;
  allDay: boolean;
  status: EventStatus;
  startDate: string;
  endDate: string;
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;
  seriesId?: string;
  exceptionDate?: string;
  isException: boolean;
  deletedOccurrences: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventOccurrence {
  id: string;
  calendarId: string;
  occurrenceDate: string;
  occurrenceStart: string;
  occurrenceEnd: string;
  name: string;
  description?: string;
  location?: string;
  color?: string;
  allDay: boolean;
  status: EventStatus;
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;
  seriesId?: string;
  isException: boolean;
}

export interface ReminderData {
  id: string;
  eventId: string;
  userId: string;
  minutesBefore: number;
}

export interface ShareData {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  profilePicture: string | null;
  role: "viewer" | "editor" | "admin";
}

export interface UserData {
  id: string;
  displayName: string;
  username: string;
  profilePicture: string | null;
}
