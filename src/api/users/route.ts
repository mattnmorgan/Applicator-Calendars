import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "@applicator/sdk/context";

export async function GET(req: NextRequest, context: ApiContext) {
  const user = await context.user();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";

  const userMgr = context.recordManager("system", "users");
  const result = await userMgr.readRecords({ limit: 200 });

  const users = result.records
    .filter((r: any) => r.id !== user.id && r.data.active !== false)
    .map((r: any) => ({
      id: r.id,
      displayName: r.data.display_name || r.data.username,
      username: r.data.username,
      profilePicture: r.data.icon ? `/api/system/assets/icons/users/${r.id}` : null,
    }))
    .filter((u: any) =>
      !query ||
      u.displayName.toLowerCase().includes(query.toLowerCase()) ||
      u.username.toLowerCase().includes(query.toLowerCase())
    );

  return NextResponse.json({ users });
}
