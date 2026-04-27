import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";

export async function GET(_req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mgr = context.recordManager("calendars", "preference");
  const result = await mgr.readRecords({ fields: { userId: user.id }, limit: 1 });
  const pref = result.records[0];

  return NextResponse.json({
    defaultView: pref?.data.defaultView || "",
  });
}

export async function PATCH(req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const mgr = context.recordManager("calendars", "preference");
    const result = await mgr.readRecords({ fields: { userId: user.id }, limit: 1 });

    if (result.records.length > 0) {
      const table = await mgr.getTable();
      await mgr.updateRecord(table, result.records[0].id, {
        defaultView: body.defaultView || "",
      } as any);
    } else {
      const table = await mgr.getTable();
      await mgr.createRecord(table, {
        userId: user.id,
        defaultView: body.defaultView || "",
      } as any);
    }

    return NextResponse.json({ defaultView: body.defaultView || "" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
