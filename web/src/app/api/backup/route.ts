import { NextResponse } from "next/server";
import { handleSqliteModuleError } from "@/lib/api-errors";
import { getDb } from "@/lib/db";
import { STATUS_NOTIFICACAO, type StatusNotificacao } from "@/types/notificacao";

type BackupNotificacao = {
  id: number;
  nome_cliente: string;
  numero_empenho: string | null;
  numero_autorizacao_fornecimento: string | null;
  empenho_recebido: string | null;
  prazo_entrega: number | null;
  data_para_entregar: string | null;
  pedido_prorrogacao: string | null;
  dias_prorrogacao: number | null;
  data_nova_para_entregar: string | null;
  observacao: string | null;
  status: StatusNotificacao;
};

type BackupPushSubscription = {
  endpoint: string;
  auth: string;
  p256dh: string;
  updated_at: number;
};

type BackupPayload = {
  app: "avisos";
  version: 1;
  generatedAt: string;
  data: {
    notificacoes: BackupNotificacao[];
    pushSubscriptions?: BackupPushSubscription[];
  };
};

function isNullableString(v: unknown): v is string | null {
  return typeof v === "string" || v === null;
}

function isNullableNumber(v: unknown): v is number | null {
  return (typeof v === "number" && Number.isFinite(v)) || v === null;
}

function isBackupNotificacao(v: unknown): v is BackupNotificacao {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "number" &&
    Number.isFinite(r.id) &&
    r.id > 0 &&
    typeof r.nome_cliente === "string" &&
    r.nome_cliente.trim() !== "" &&
    isNullableString(r.numero_empenho) &&
    isNullableString(r.numero_autorizacao_fornecimento) &&
    isNullableString(r.empenho_recebido) &&
    isNullableNumber(r.prazo_entrega) &&
    isNullableString(r.data_para_entregar) &&
    isNullableString(r.pedido_prorrogacao) &&
    isNullableNumber(r.dias_prorrogacao) &&
    isNullableString(r.data_nova_para_entregar) &&
    isNullableString(r.observacao) &&
    typeof r.status === "string" &&
    STATUS_NOTIFICACAO.includes(r.status as StatusNotificacao)
  );
}

function isBackupPushSubscription(v: unknown): v is BackupPushSubscription {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.endpoint === "string" &&
    r.endpoint.trim() !== "" &&
    typeof r.auth === "string" &&
    r.auth.trim() !== "" &&
    typeof r.p256dh === "string" &&
    r.p256dh.trim() !== "" &&
    typeof r.updated_at === "number" &&
    Number.isFinite(r.updated_at)
  );
}

function parseBackupPayload(body: unknown): BackupPayload | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  if (root.app !== "avisos" || root.version !== 1) return null;
  if (typeof root.generatedAt !== "string" || root.generatedAt.trim() === "") return null;
  if (!root.data || typeof root.data !== "object") return null;
  const data = root.data as Record<string, unknown>;
  if (!Array.isArray(data.notificacoes)) return null;
  if (!data.notificacoes.every(isBackupNotificacao)) return null;
  if (
    data.pushSubscriptions !== undefined &&
    (!Array.isArray(data.pushSubscriptions) ||
      !data.pushSubscriptions.every(isBackupPushSubscription))
  ) {
    return null;
  }

  return {
    app: "avisos",
    version: 1,
    generatedAt: root.generatedAt,
    data: {
      notificacoes: data.notificacoes,
      pushSubscriptions: Array.isArray(data.pushSubscriptions)
        ? data.pushSubscriptions
        : undefined,
    },
  };
}

export async function GET() {
  try {
    const db = getDb();
    const notificacoes = db
      .prepare("SELECT * FROM notificacao ORDER BY id ASC")
      .all() as BackupNotificacao[];
    const pushSubscriptions = db
      .prepare("SELECT endpoint, auth, p256dh, updated_at FROM push_subscription")
      .all() as BackupPushSubscription[];

    const payload: BackupPayload = {
      app: "avisos",
      version: 1,
      generatedAt: new Date().toISOString(),
      data: {
        notificacoes,
        pushSubscriptions,
      },
    };

    return NextResponse.json(payload);
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const payload = parseBackupPayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: "Arquivo de backup inválido ou incompatível." },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const insertNotificacao = db.prepare(
      `INSERT INTO notificacao (
        id,
        nome_cliente,
        numero_empenho,
        numero_autorizacao_fornecimento,
        empenho_recebido,
        prazo_entrega,
        data_para_entregar,
        pedido_prorrogacao,
        dias_prorrogacao,
        data_nova_para_entregar,
        observacao,
        status
      ) VALUES (
        @id,
        @nome_cliente,
        @numero_empenho,
        @numero_autorizacao_fornecimento,
        @empenho_recebido,
        @prazo_entrega,
        @data_para_entregar,
        @pedido_prorrogacao,
        @dias_prorrogacao,
        @data_nova_para_entregar,
        @observacao,
        @status
      )`
    );
    const insertPush = db.prepare(
      `INSERT INTO push_subscription (endpoint, auth, p256dh, updated_at)
       VALUES (@endpoint, @auth, @p256dh, @updated_at)`
    );

    const restoreTx = db.transaction((input: BackupPayload) => {
      db.prepare("DELETE FROM notificacao").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'notificacao'").run();

      for (const n of input.data.notificacoes) {
        insertNotificacao.run({
          ...n,
          nome_cliente: n.nome_cliente.trim(),
        });
      }

      if (input.data.pushSubscriptions) {
        db.prepare("DELETE FROM push_subscription").run();
        for (const sub of input.data.pushSubscriptions) {
          insertPush.run(sub);
        }
      }
    });

    restoreTx(payload);

    return NextResponse.json({
      ok: true,
      restored: {
        notificacoes: payload.data.notificacoes.length,
        pushSubscriptions: payload.data.pushSubscriptions?.length ?? null,
      },
    });
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}
