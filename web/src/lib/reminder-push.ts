import fs from "fs";
import path from "path";
import webpush from "web-push";
import { getDb } from "@/lib/db";
import { configureWebPush, isPushConfigured } from "@/lib/web-push-server";

/** Mesma regra que `scripts/check-entregas-reminder.cjs` (toast Windows, desativado). */
export const REMINDER_DUE_SQL = `
    SELECT
      id,
      nome_cliente,
      status,
      CASE
        WHEN status = 'PENDENTE' THEN data_para_entregar
        WHEN status = 'PRORROGADO' THEN data_nova_para_entregar
      END AS data_referencia
    FROM notificacao
    WHERE status IN ('PENDENTE', 'PRORROGADO')
      AND (
        (
          status = 'PENDENTE'
          AND data_para_entregar IS NOT NULL
          AND TRIM(data_para_entregar) != ''
          AND date(data_para_entregar) >= date('now', 'localtime')
          AND date(data_para_entregar) <= date('now', 'localtime', '+1 days')
          AND date(data_para_entregar) <= date('now', 'localtime', '+2 days')
        )
        OR (
          status = 'PRORROGADO'
          AND data_nova_para_entregar IS NOT NULL
          AND TRIM(data_nova_para_entregar) != ''
          AND date(data_nova_para_entregar) <= date('now', 'localtime', '+1 days')
          AND date(data_nova_para_entregar) <= date('now', 'localtime', '+2 days')
        )
      )
    ORDER BY date(data_referencia), id
  `;

type DueRow = {
  id: number;
  nome_cliente: string;
  status: string;
  data_referencia: string | null;
};

type SubRow = { endpoint: string; auth: string; p256dh: string };

const statePath = () =>
  path.join(process.cwd(), "data", "reminder-push-state.json");

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadState(): { day: string; signature: string } | null {
  try {
    const raw = fs.readFileSync(statePath(), "utf8");
    const j = JSON.parse(raw) as { day?: string; signature?: string };
    if (typeof j.day === "string" && typeof j.signature === "string") {
      return { day: j.day, signature: j.signature };
    }
    return null;
  } catch {
    return null;
  }
}

function saveState(day: string, signature: string) {
  try {
    fs.writeFileSync(
      statePath(),
      JSON.stringify(
        { day, signature, updatedAt: new Date().toISOString() },
        null,
        2
      ),
      "utf8"
    );
  } catch (e) {
    console.error(
      "[reminder-push] não foi possível gravar estado:",
      e instanceof Error ? e.message : e
    );
  }
}

function buildMessage(rows: DueRow[]): { title: string; body: string } {
  const lines = rows.map((r) => {
    const nome = (r.nome_cliente || "(sem nome)").slice(0, 44);
    const ref = r.data_referencia || "—";
    return `• ${nome} — ${r.status} — ${ref}`;
  });
  const body =
    lines.length > 8
      ? lines.slice(0, 8).join("\n") +
        `\n… e mais ${rows.length - 8} registro(s).`
      : lines.join("\n");
  return {
    title: "Avisos — prazos (hoje a +2 dias)",
    body: `${rows.length} registro(s):\n${body}`,
  };
}

export function isReminderPushEnabled(): boolean {
  const v = process.env.REMINDER_PUSH_ENABLED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return process.env.NODE_ENV === "production";
}

export function getReminderPushIntervalMs(): number {
  const raw = process.env.REMINDER_PUSH_INTERVAL_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60_000) return n;
  }
  return 2 * 60 * 60 * 1000;
}

/**
 * Consulta prazos na janela (hoje … hoje+2), deduplica por dia como o toast antigo,
 * envia Web Push a todas as subscrições. Grava estado só se pelo menos um envio HTTP 2xx.
 */
export async function runReminderPushOnce(): Promise<void> {
  if (!isReminderPushEnabled()) {
    return;
  }
  if (!isPushConfigured() || !configureWebPush()) {
    return;
  }

  const db = getDb();
  let rows: DueRow[];
  try {
    rows = db.prepare(REMINDER_DUE_SQL).all() as DueRow[];
  } catch (e) {
    console.error(
      "[reminder-push] consulta:",
      e instanceof Error ? e.message : e
    );
    return;
  }

  if (rows.length === 0) {
    return;
  }

  const signature = rows
    .map((r) => String(r.id))
    .sort((a, b) => Number(a) - Number(b))
    .join(",");

  const day = todayLocal();
  const prev = loadState();
  if (prev && prev.day === day && prev.signature === signature) {
    return;
  }

  const subs = db
    .prepare(
      "SELECT endpoint, auth, p256dh FROM push_subscription ORDER BY updated_at DESC"
    )
    .all() as SubRow[];

  if (subs.length === 0) {
    console.warn(
      "[reminder-push] há prazos na janela mas nenhuma subscrição push."
    );
    return;
  }

  const { title, body } = buildMessage(rows);
  const payload = JSON.stringify({ title, body });

  const subscription = (r: SubRow) => ({
    endpoint: r.endpoint,
    keys: { auth: r.auth, p256dh: r.p256dh },
  });

  const del = db.prepare("DELETE FROM push_subscription WHERE endpoint = ?");
  let anyOk = false;

  for (const r of subs) {
    try {
      await webpush.sendNotification(subscription(r), payload, {
        TTL: 86_400,
        urgency: "high",
      });
      anyOk = true;
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 404 || status === 410) {
        del.run(r.endpoint);
      } else {
        console.error(
          "[reminder-push] falha ao enviar:",
          r.endpoint.slice(0, 48),
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  if (anyOk) {
    saveState(day, signature);
    console.log(
      `[reminder-push] enviado (${rows.length} registro(s) na janela, ${subs.length} subscrição(ões)).`
    );
  }
}

