import { NextResponse, type NextRequest } from "next/server";
import { consumeToken } from "@/lib/approval-tokens";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await consumeToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, action: result.action });
}
