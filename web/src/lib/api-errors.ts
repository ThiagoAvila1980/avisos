import { NextResponse } from "next/server";
import { SqliteModuleError } from "@/lib/db";

export function handleSqliteModuleError(e: unknown): NextResponse | null {
  if (e instanceof SqliteModuleError) {
    return NextResponse.json({ error: e.message }, { status: 503 });
  }
  return null;
}
