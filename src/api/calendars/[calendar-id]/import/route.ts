import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import { CategoryRecord, EventRecord } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";

export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (!["owner", "admin", "editor"].includes(access.level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const importCategories: { name: string; color: string }[] = body.categories || [];
    const importEvents: any[] = body.events || [];
    const importSubscriptions: { name: string; url: string; color?: string }[] = body.subscriptions || [];

    const now = new Date().toISOString();
    const catRm = context.recordManager<CategoryRecord>("calendars", "category");
    const catTable = await catRm.getTable();

    // Load existing categories to avoid duplicates (match by name)
    const existingCats = await catRm.readRecords({ fields: { calendarId: params.calendarId }, limit: 500 });
    const existingCatByName = new Map<string, string>(
      existingCats.records.map((r: any) => [r.data.name as string, r.id as string])
    );

    // Create or reuse categories — build a name→id map for event linking
    const categoryIdByName = new Map<string, string>(existingCatByName);
    let categoriesImported = 0;

    for (const cat of importCategories) {
      if (!cat.name?.trim()) continue;
      if (categoryIdByName.has(cat.name)) continue;
      const record = await catRm.createRecord(catTable, {
        calendarId: params.calendarId,
        name: cat.name.trim(),
        color: cat.color || "#3B82F6",
        ownerId: user.id,
        createdAt: now,
        updatedAt: now,
      } as any);
      categoryIdByName.set(cat.name, record.id);
      categoriesImported++;
    }

    // Import events
    const eventsRm = context.recordManager<EventRecord>("calendars", "event");
    const eventsTable = await eventsRm.getTable();
    let eventsImported = 0;
    const errors: string[] = [];

    for (const ev of importEvents) {
      if (!ev.name?.trim() || !ev.startDate || !ev.endDate) {
        errors.push(`Skipped event "${ev.name || "(unnamed)"}" — missing required fields`);
        continue;
      }
      try {
        const categoryId = ev.categoryName ? (categoryIdByName.get(ev.categoryName) || null) : null;
        const recurrenceRule = ev.recurrenceRule
          ? (typeof ev.recurrenceRule === "string" ? ev.recurrenceRule : JSON.stringify(ev.recurrenceRule))
          : null;
        await eventsRm.createRecord(eventsTable, {
          calendarId: params.calendarId,
          name: ev.name.trim(),
          description: ev.description || "",
          location: ev.location || "",
          color: ev.color || "",
          allDay: !!ev.allDay,
          status: ev.status || "free",
          startDate: ev.startDate,
          endDate: ev.endDate,
          isRecurring: !!ev.isRecurring,
          recurrenceRule,
          seriesId: null,
          exceptionDate: ev.exceptionDate || null,
          isException: !!ev.isException,
          deletedOccurrences: ev.deletedOccurrences || null,
          categoryId,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        } as any);
        eventsImported++;
      } catch (e: any) {
        errors.push(`Failed to import event "${ev.name}": ${e.message}`);
      }
    }

    // Import subscriptions (create only — no auto-sync)
    const subRm = (context as any).recordManager("calendars", "ics_subscription");
    const subTable = await subRm.getTable();
    let subscriptionsImported = 0;

    for (const sub of importSubscriptions) {
      if (!sub.name?.trim() || !sub.url?.trim()) continue;
      try {
        await subRm.createRecord(subTable, {
          calendarId: params.calendarId,
          name: sub.name.trim(),
          url: sub.url.trim(),
          color: sub.color || "#3B82F6",
          ownerId: user.id,
          lastSynced: null,
          createdAt: now,
          updatedAt: now,
        });
        subscriptionsImported++;
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ categoriesImported, eventsImported, subscriptionsImported, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
