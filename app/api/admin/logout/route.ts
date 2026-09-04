import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await destroySession();
  // 303 forces the browser to continue with GET after a form POST. A 307
  // would repeat POST against the homepage and can leave the old layout shown.
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
