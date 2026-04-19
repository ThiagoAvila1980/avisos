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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const db = getDb();
    const row = db.prepare("SELECT * FROM notificacao WHERE id = ?").get(numId);
    if (!row) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
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
    const exists = db.prepare("SELECT 1 FROM notificacao WHERE id = ?").get(numId);
    if (!exists) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    db.prepare(
      `UPDATE notificacao SET
      nome_cliente = @nome_cliente,
      numero_empenho = @numero_empenho,
      numero_autorizacao_fornecimento = @numero_autorizacao_fornecimento,
      empenho_recebido = @empenho_recebido,
      prazo_entrega = @prazo_entrega,
      data_para_entregar = @data_para_entregar,
      pedido_prorrogacao = @pedido_prorrogacao,
      dias_prorrogacao = @dias_prorrogacao,
      data_nova_para_entregar = @data_nova_para_entregar,
      observacao = @observacao,
      status = @status
    WHERE id = @id`
    ).run({ ...parsed, id: numId });
    const row = db.prepare("SELECT * FROM notificacao WHERE id = ?").get(numId);
    return NextResponse.json(row);
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const db = getDb();
    const result = db.prepare("DELETE FROM notificacao WHERE id = ?").run(numId);
    if (result.changes === 0) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const r = handleSqliteModuleError(e);
    if (r) return r;
    throw e;
  }
}
