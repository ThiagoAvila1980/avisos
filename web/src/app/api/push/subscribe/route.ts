import { NextResponse } from "next/server";
import { handleSqliteModuleError } from "@/lib/api-errors";
import { getDb } from "@/lib/db";

type Body = {
  endpoint?: string;
  keys?: { auth?: string; p256dh?: string };
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  if (!endpoint || !auth || !p256dh) {
    return NextResponse.json(
      { error: "subscription inválida (endpoint, keys.auth, keys.p256dh)." },
      { status: 400 }
    );
  }
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT OR REPLACE INTO push_subscription (endpoint, auth, p256dh, updated_at)
       VALUES (@endpoint, @auth, @p256dh, @updated_at)`
    ).run({ endpoint, auth, p256dh, updated_at: now });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}

export async function DELETE(request: Request) {
  let body: { endpoint?: string };
  try {
    body = (await request.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const endpoint =
    typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint obrigatório." }, { status: 400 });
  }
  try {
    const db = getDb();
    db.prepare("DELETE FROM push_subscription WHERE endpoint = ?").run(endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}
