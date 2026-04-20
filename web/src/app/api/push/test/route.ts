import { NextResponse } from "next/server";
import webpush from "web-push";
import { handleSqliteModuleError } from "@/lib/api-errors";
import { getDb } from "@/lib/db";
import {
  DEFAULT_PUSH_BODY,
  DEFAULT_PUSH_TITLE,
} from "@/lib/push-defaults";
import { configureWebPush, isPushConfigured } from "@/lib/web-push-server";

type Row = {
  endpoint: string;
  auth: string;
  p256dh: string;
};

function authorize(request: Request): boolean {
  const secret = process.env.PUSH_TEST_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isPushConfigured()) {
    return NextResponse.json(
      {
        error:
          "Push não configurado: defina NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT.",
      },
      { status: 503 }
    );
  }
  if (!authorize(request)) {
    return NextResponse.json(
      { error: "Não autorizado. Envie Authorization: Bearer <PUSH_TEST_SECRET>." },
      { status: 401 }
    );
  }
  if (!configureWebPush()) {
    return NextResponse.json({ error: "Falha ao configurar VAPID." }, { status: 503 });
  }

  let title = DEFAULT_PUSH_TITLE;
  let body = DEFAULT_PUSH_BODY;
  try {
    const json = (await request.json()) as { title?: string; body?: string };
    if (typeof json.title === "string" && json.title.trim()) title = json.title.trim();
    if (typeof json.body === "string" && json.body.trim()) body = json.body.trim();
  } catch {
    /* Corpo opcional: usa sempre os valores padrão em push-defaults. */
  }

  const payload = JSON.stringify({ title, body });

  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT endpoint, auth, p256dh FROM push_subscription ORDER BY updated_at DESC"
      )
      .all() as Row[];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma subscrição registada. Ative as notificações na app primeiro." },
        { status: 404 }
      );
    }

    const subscription = (r: Row) => ({
      endpoint: r.endpoint,
      keys: { auth: r.auth, p256dh: r.p256dh },
    });

    let sent = 0;
    let removed = 0;
    const errors: string[] = [];

    const del = db.prepare("DELETE FROM push_subscription WHERE endpoint = ?");

    for (const r of rows) {
      try {
        await webpush.sendNotification(subscription(r), payload, {
          TTL: 60,
          urgency: "high",
        });
        sent++;
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (status === 404 || status === 410) {
          del.run(r.endpoint);
          removed++;
        } else {
          const msg =
            err instanceof Error ? err.message : String(err ?? "erro desconhecido");
          errors.push(`${r.endpoint.slice(0, 48)}…: ${msg}`);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      removedStale: removed,
      failed: errors.length,
      errors: errors.slice(0, 5),
    });
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}
