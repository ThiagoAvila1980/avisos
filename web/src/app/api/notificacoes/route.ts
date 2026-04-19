import { NextResponse } from "next/server";
import { handleSqliteModuleError } from "@/lib/api-errors";
import { getDb } from "@/lib/db";
import { STATUS_NOTIFICACAO, type NotificacaoInput } from "@/types/notificacao";

function parseBody(data: Record<string, unknown>): NotificacaoInput | null {
  const nome = data.nome_cliente;
  if (typeof nome !== "string" || !nome.trim()) {
    return null;
  }
  const status = data.status;
  if (
    typeof status !== "string" ||
    !STATUS_NOTIFICACAO.includes(status as (typeof STATUS_NOTIFICACAO)[number])
  ) {
    return null;
  }
  const num = (v: unknown) =>
    v === null || v === undefined || v === ""
      ? null
      : typeof v === "number" && Number.isFinite(v)
        ? v
        : typeof v === "string" && v.trim() !== ""
          ? Number(v)
          : null;
  const str = (v: unknown) =>
    v === null || v === undefined ? null : String(v).trim() === "" ? null : String(v);
  const dateStr = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : String(v);

  const parsed: NotificacaoInput = {
    nome_cliente: nome.trim(),
    numero_empenho: str(data.numero_empenho),
    numero_autorizacao_fornecimento: str(data.numero_autorizacao_fornecimento),
    empenho_recebido: dateStr(data.empenho_recebido),
    prazo_entrega: num(data.prazo_entrega),
    data_para_entregar: dateStr(data.data_para_entregar),
    pedido_prorrogacao: dateStr(data.pedido_prorrogacao),
    dias_prorrogacao: num(data.dias_prorrogacao),
    data_nova_para_entregar: dateStr(data.data_nova_para_entregar),
    observacao: str(data.observacao),
    status: status as NotificacaoInput["status"],
  };
  if (parsed.data_nova_para_entregar) {
    parsed.status = "PRORROGADO";
  }
  return parsed;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const db = getDb();
    if (!q) {
      const rows = db.prepare(`SELECT * FROM notificacao ORDER BY id DESC`).all();
      return NextResponse.json(rows);
    }
    const like = `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const rows = db
      .prepare(
        `SELECT * FROM notificacao
       WHERE nome_cliente LIKE ? ESCAPE '\\'
          OR IFNULL(numero_empenho,'') LIKE ? ESCAPE '\\'
          OR IFNULL(numero_autorizacao_fornecimento,'') LIKE ? ESCAPE '\\'
          OR IFNULL(observacao,'') LIKE ? ESCAPE '\\'
       ORDER BY id DESC`
      )
      .all(like, like, like, like);
    return NextResponse.json(rows);
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Dados inválidos: nome do cliente e status são obrigatórios." },
      { status: 400 }
    );
  }
  try {
    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO notificacao (
        nome_cliente, numero_empenho, numero_autorizacao_fornecimento,
        empenho_recebido, prazo_entrega, data_para_entregar,
        pedido_prorrogacao, dias_prorrogacao, data_nova_para_entregar,
        observacao, status
      ) VALUES (
        @nome_cliente, @numero_empenho, @numero_autorizacao_fornecimento,
        @empenho_recebido, @prazo_entrega, @data_para_entregar,
        @pedido_prorrogacao, @dias_prorrogacao, @data_nova_para_entregar,
        @observacao, @status
      )`
      )
      .run(parsed);
    const row = db
      .prepare("SELECT * FROM notificacao WHERE id = ?")
      .get(result.lastInsertRowid) as Record<string, unknown>;
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}
