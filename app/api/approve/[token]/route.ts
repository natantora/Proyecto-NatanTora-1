import { NextResponse, type NextRequest } from "next/server";
import { consumeToken } from "@/lib/approval-tokens";

export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const result = await consumeToken(params.token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, action: result.action });
}
