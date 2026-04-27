import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";
import sharp from "sharp";
import { CalendarRecord } from "@/src/types";
import { getCalendarAccess } from "@/src/lib/calendar-access";

export async function GET(
  _req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const mgr = context.recordManager<CalendarRecord>("calendars", "calendar");
  const cal = await mgr.readRecord(params.calendarId);
  if (!cal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const iconPath = `icons/calendars/${params.calendarId}.jpg`;

  if (await context.appFileManager.exists(iconPath)) {
    const data = await context.appFileManager.readFile(iconPath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (cal.data.iconData) {
    const base64 = cal.data.iconData.replace(/^data:image\/[^;]+;base64,/, "");
    const buf = Buffer.from(base64, "base64");
    const resized = await sharp(buf).resize(64, 64, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
    await context.appFileManager.writeFile(iconPath, resized);

    const table = await mgr.getTable();
    await mgr.updateRecord(table, params.calendarId, { hasIcon: true, iconData: null } as any);

    return new NextResponse(resized, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return NextResponse.json({ error: "No icon" }, { status: 404 });
}

export async function POST(
  req: NextRequest,
  context: ApiContext,
  params: { calendarId: string }
) {
  const access = await getCalendarAccess(context, params.calendarId);
  if (!access) return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  if (access.level === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const buffer = Buffer.from(await req.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(64, 64, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();

    const iconPath = `icons/calendars/${params.calendarId}.jpg`;
    await context.appFileManager.writeFile(iconPath, resized);

    const mgr = context.recordManager<CalendarRecord>("calendars", "calendar");
    const table = await mgr.getTable();
    await mgr.updateRecord(table, params.calendarId, {
      hasIcon: true,
      iconData: null,
      updatedAt: new Date().toISOString(),
    } as any);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
