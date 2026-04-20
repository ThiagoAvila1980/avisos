"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardListIcon,
  PencilIcon,
  Plus,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import type { Notificacao, StatusNotificacao } from "@/types/notificacao";
import { STATUS_NOTIFICACAO } from "@/types/notificacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/api-base";
import { PushSubscribeToolbar } from "@/components/push-subscribe-toolbar";
import { cn } from "@/lib/utils";

const cardFormClass =
  "border-primary/15 bg-card/90 shadow-sm ring-1 ring-primary/[0.06] backdrop-blur-[2px]";

async function readApiError(res: Response): Promise<string> {
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  return j.error ?? `Erro HTTP ${res.status}`;
}

type FormState = {
  nome_cliente: string;
  numero_empenho: string;
  numero_autorizacao_fornecimento: string;
  empenho_recebido: string;
  prazo_entrega: string;
  data_para_entregar: string;
  pedido_prorrogacao: string;
  dias_prorrogacao: string;
  data_nova_para_entregar: string;
  observacao: string;
  status: StatusNotificacao;
};

const emptyForm = (): FormState => ({
  nome_cliente: "",
  numero_empenho: "",
  numero_autorizacao_fornecimento: "",
  empenho_recebido: "",
  prazo_entrega: "",
  data_para_entregar: "",
  pedido_prorrogacao: "",
  dias_prorrogacao: "",
  data_nova_para_entregar: "",
  observacao: "",
  status: "PENDENTE",
});

function fromRow(row: Notificacao): FormState {
  const s = (v: string | number | null | undefined) =>
    v === null || v === undefined ? "" : String(v);
  return {
    nome_cliente: row.nome_cliente,
    numero_empenho: s(row.numero_empenho),
    numero_autorizacao_fornecimento: s(row.numero_autorizacao_fornecimento),
    empenho_recebido: s(row.empenho_recebido),
    prazo_entrega: row.prazo_entrega === null ? "" : String(row.prazo_entrega),
    data_para_entregar: s(row.data_para_entregar),
    pedido_prorrogacao: s(row.pedido_prorrogacao),
    dias_prorrogacao:
      row.dias_prorrogacao === null ? "" : String(row.dias_prorrogacao),
    data_nova_para_entregar: s(row.data_nova_para_entregar),
    observacao: s(row.observacao),
    status: row.status,
  };
}

function toPayload(f: FormState): Record<string, unknown> {
  const intOrNull = (v: string) => {
    const t = v.trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
  };
  const dateOrNull = (v: string) => (v.trim() ? v : null);
  return {
    nome_cliente: f.nome_cliente.trim(),
    numero_empenho: f.numero_empenho.trim() || null,
    numero_autorizacao_fornecimento:
      f.numero_autorizacao_fornecimento.trim() || null,
    empenho_recebido: dateOrNull(f.empenho_recebido),
    prazo_entrega: intOrNull(f.prazo_entrega),
    data_para_entregar: dateOrNull(f.data_para_entregar),
    pedido_prorrogacao: dateOrNull(f.pedido_prorrogacao),
    dias_prorrogacao: intOrNull(f.dias_prorrogacao),
    data_nova_para_entregar: dateOrNull(f.data_nova_para_entregar),
    observacao: f.observacao.trim() || null,
    status: f.status,
  };
}

/** Soma dias a uma data civil YYYY-MM-DD (sem UTC; evita deslocar o dia por fuso). */
function addDaysToIsoDate(yyyyMmDd: string, dias: number): string {
  const s = yyyyMmDd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const y = parseInt(s.slice(0, 4), 10);
  const m = parseInt(s.slice(5, 7), 10);
  const d = parseInt(s.slice(8, 10), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return "";
  dt.setDate(dt.getDate() + dias);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Data base (YYYY-MM-DD) + dias (inteiro ≥ 0); vazio se faltar valor ou prazo inválido. */
function calcularDataSomandoPrazo(dataBase: string, diasStr: string): string {
  const d0 = dataBase.trim();
  const p = diasStr.trim();
  if (!d0 || p === "") return "";
  const dias = parseInt(p, 10);
  if (!Number.isFinite(dias) || dias < 0) return "";
  return addDaysToIsoDate(d0, dias);
}

function formatDateBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Cores fixas dos estados (lista + cartões). */
function statusBadgeClassName(s: StatusNotificacao): string {
  switch (s) {
    case "PENDENTE":
      return "border-transparent bg-orange-500 text-white hover:bg-orange-500";
    case "PRORROGADO":
      return "border-transparent bg-red-600 text-white hover:bg-red-600";
    case "ENTREGUE":
      return "border-transparent bg-green-600 text-white hover:bg-green-600";
    default:
      return "";
  }
}

/** Borda esquerda dos cartões mobile alinhada ao status. */
function statusCardLeftBorderClassName(s: StatusNotificacao): string {
  switch (s) {
    case "PENDENTE":
      return "border-l-orange-500";
    case "PRORROGADO":
      return "border-l-red-600";
    case "ENTREGUE":
      return "border-l-green-600";
    default:
      return "border-l-border";
  }
}

/** Data de entrega a mostrar no cartão resumido (prioriza nova data se prorrogado). */
function dataEntregaResumo(n: Notificacao): string {
  if (n.status === "PRORROGADO" && n.data_nova_para_entregar?.trim()) {
    return formatDateBR(n.data_nova_para_entregar);
  }
  return formatDateBR(n.data_para_entregar);
}

export function NotificacoesApp() {
  const [tab, setTab] = useState("lista");
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Notificacao | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLista = useCallback(async (queryOverride?: string) => {
    setLoading(true);
    try {
      const q =
        queryOverride !== undefined ? queryOverride.trim() : search.trim();
      const url = q
        ? apiUrl(`/api/notificacoes?q=${encodeURIComponent(q)}`)
        : apiUrl("/api/notificacoes");
      const res = await fetch(url);
      if (!res.ok) throw new Error(await readApiError(res));
      const data = (await res.json()) as Notificacao[];
      setLista(data);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as notificações."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/notificacoes"));
        if (!res.ok) throw new Error(await readApiError(res));
        const data = (await res.json()) as Notificacao[];
        setLista(data);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar as notificações."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadForEdit(id: number) {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/notificacoes/${id}`));
      if (!res.ok) throw new Error(await readApiError(res));
      const row = (await res.json()) as Notificacao;
      setForm(fromRow(row));
      setEditingId(id);
      setTab("cadastro");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Registro não encontrado."
      );
    } finally {
      setLoading(false);
    }
  }

  function novoCadastro() {
    setForm(emptyForm());
    setEditingId(null);
    setTab("cadastro");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome_cliente.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      const url =
        editingId !== null
          ? apiUrl(`/api/notificacoes/${editingId}`)
          : apiUrl("/api/notificacoes");
      const res = await fetch(url, {
        method: editingId !== null ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Erro ao salvar");
      }
      toast.success(
        editingId !== null ? "Notificação atualizada." : "Notificação criada."
      );
      setForm(emptyForm());
      setEditingId(null);
      setSearch("");
      await fetchLista("");
      setTab("lista");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/notificacoes/${deleteTarget.id}`), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Notificação excluída.");
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) {
        setForm(emptyForm());
        setEditingId(null);
      }
      await fetchLista();
    } catch {
      toast.error("Não foi possível excluir.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-2 pb-6 md:gap-8 md:p-8 md:pb-16">
      <header className="space-y-3 rounded-lg border border-primary/10 bg-primary/[0.1] p-3 shadow-sm ring-1 ring-primary/[0.06] md:space-y-4 md:rounded-2xl md:border-primary/15 md:bg-primary/[0.14] md:p-5 md:ring-primary/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner ring-1 ring-primary/20"
              aria-hidden
            >
              <ClipboardListIcon className="size-7" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Controle de prazos de notificações
              </h1>
            </div>
          </div>
          <PushSubscribeToolbar />
        </div>
        <div
          className="h-px w-full bg-gradient-to-r from-transparent via-primary/35 to-transparent"
          aria-hidden
        />
      </header>

      <div className="flex flex-1 flex-col gap-3 md:gap-5">
        <div
          className="inline-flex h-9 w-fit items-center justify-center rounded-xl border border-primary/15 bg-primary/10 p-1 text-muted-foreground shadow-sm ring-1 ring-primary/10"
          role="tablist"
          aria-label="Seções da aplicação"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "lista"}
            id="tab-trigger-lista"
            className={cn(
              "relative inline-flex h-[calc(100%-1px)] min-w-[7.5rem] items-center justify-center rounded-lg border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              tab === "lista"
                ? "bg-card text-foreground shadow-md ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
            )}
            onClick={() => setTab("lista")}
          >
            Notificações
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "cadastro"}
            id="tab-trigger-cadastro"
            className={cn(
              "relative inline-flex h-[calc(100%-1px)] min-w-[7.5rem] items-center justify-center rounded-lg border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              tab === "cadastro"
                ? "bg-card text-foreground shadow-md ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
            )}
            onClick={() => setTab("cadastro")}
          >
            Cadastro
          </button>
        </div>

        {tab === "lista" && (
          <div
            className="flex flex-col gap-3 outline-none md:gap-4"
            role="tabpanel"
            id="tab-panel-lista"
            aria-labelledby="tab-trigger-lista"
          >
          <div className="form-fields-white flex flex-col gap-2 md:gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="busca">Pesquisar</Label>
              <div className="flex min-w-0 flex-nowrap items-center gap-1.5 md:gap-2">
                <Input
                  id="busca"
                  placeholder="Cliente, empenho, autorização ou observação…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void fetchLista();
                  }}
                  className="h-8 w-auto min-w-0 max-w-[17rem] flex-1 md:h-9"
                />
                <div className="flex shrink-0 gap-1.5 md:gap-2">
                  <Button type="button" onClick={() => void fetchLista()}>
                    Buscar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      void fetchLista("");
                    }}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Card className="overflow-hidden border-primary/10 shadow-sm ring-1 ring-primary/[0.05] md:border-primary/15 md:shadow-md md:ring-primary/[0.07]">
            <CardHeader className="border-b border-primary/10 bg-primary/[0.1] px-3 pb-2 md:border-primary/15 md:bg-primary/[0.14] md:pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Lista
              </CardTitle>
              <CardDescription>
                {loading
                  ? "Carregando…"
                  : search.trim()
                    ? `${lista.length} registro(s) com o filtro de pesquisa ativo (“${search.trim()}”). Use Limpar para ver todos.`
                    : `${lista.length} registro(s) encontrado(s).`}
              </CardDescription>
              <CardAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-foreground hover:bg-primary/20"
                  onClick={() => void fetchLista()}
                  title="Atualizar lista"
                  aria-label="Atualizar lista"
                >
                  <RefreshCwIcon
                    className={cn("size-6", loading && "animate-spin")}
                  />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile: cartões enxutos */}
              <div className="flex flex-col gap-1.5 p-2 md:hidden">
                {lista.length === 0 && !loading ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Nenhum registro. Use a aba Cadastro ou o botão +.
                  </p>
                ) : (
                  lista.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "border-border/70 bg-card/80 rounded-lg border border-l-4 px-2.5 py-2 shadow-sm ring-1 ring-primary/[0.05]",
                        statusCardLeftBorderClassName(n.status)
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-foreground min-w-0 flex-1 text-sm leading-snug font-semibold">
                          {n.nome_cliente}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px] uppercase",
                            statusBadgeClassName(n.status)
                          )}
                        >
                          {n.status}
                        </Badge>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-sm">
                        <div>
                          <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">
                            Empenho
                          </dt>
                          <dd className="text-foreground mt-0.5 font-medium tabular-nums">
                            {n.numero_empenho?.trim() || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">
                            Aut. fornec.
                          </dt>
                          <dd className="text-foreground mt-0.5 font-medium tabular-nums">
                            {n.numero_autorizacao_fornecimento?.trim() || "—"}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">
                            {n.status === "PRORROGADO" &&
                            n.data_nova_para_entregar?.trim()
                              ? "Entregar (nova)"
                              : "Entregar"}
                          </dt>
                          <dd className="text-foreground mt-0.5 font-semibold tabular-nums">
                            {dataEntregaResumo(n)}
                          </dd>
                        </div>
                      </dl>
                      <div className="border-border/60 mt-2 flex justify-end gap-1 border-t pt-1.5">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          title="Editar"
                          onClick={() => void loadForEdit(n.id)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          title="Excluir"
                          onClick={() => setDeleteTarget(n)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Tablet/desktop: tabela completa */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-primary/15 bg-primary/[0.12] hover:bg-primary/[0.12]">
                      <TableHead className="min-w-[140px]">Cliente</TableHead>
                      <TableHead className="min-w-[100px]">Empenho</TableHead>
                      <TableHead className="min-w-[120px]">
                        Aut. fornecimento
                      </TableHead>
                      <TableHead>Emp. recebido</TableHead>
                      <TableHead>Entregar</TableHead>
                      <TableHead>Ped. prorrogação</TableHead>
                      <TableHead>Nova entrega</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.length === 0 && !loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-muted-foreground h-24 text-center"
                        >
                          Nenhum registro. Use a aba Cadastro ou “Nova
                          notificação”.
                        </TableCell>
                      </TableRow>
                    ) : (
                      lista.map((n) => (
                        <TableRow
                          key={n.id}
                          className="border-primary/5 transition-colors hover:bg-primary/[0.04]"
                        >
                          <TableCell className="font-medium">
                            {n.nome_cliente}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {n.numero_empenho ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {n.numero_autorizacao_fornecimento ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateBR(n.empenho_recebido)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateBR(n.data_para_entregar)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateBR(n.pedido_prorrogacao)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateBR(n.data_nova_para_entregar)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusBadgeClassName(n.status)}
                            >
                              {n.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                title="Editar"
                                onClick={() => void loadForEdit(n.id)}
                              >
                                <PencilIcon className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                title="Excluir"
                                onClick={() => setDeleteTarget(n)}
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Button
            type="button"
            variant="default"
            size="icon-lg"
            className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg ring-2 ring-primary/25 md:bottom-8 md:right-8"
            onClick={novoCadastro}
            title="Nova notificação"
            aria-label="Nova notificação"
          >
            <Plus className="size-7" strokeWidth={2} />
          </Button>
          </div>
        )}

        {tab === "cadastro" && (
          <div
            className="outline-none"
            role="tabpanel"
            id="tab-panel-cadastro"
            aria-labelledby="tab-trigger-cadastro"
          >
          <form
            onSubmit={handleSubmit}
            className="form-fields-white flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-sm">
                {editingId !== null
                  ? `Editando registro #${editingId}`
                  : "Novo registro"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm(emptyForm());
                  setEditingId(null);
                }}
              >
                Limpar formulário
              </Button>
            </div>

            <Card className={cardFormClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  Cliente e documentos
                </CardTitle>
                
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="nome_cliente">Nome do cliente *</Label>
                  <Input
                    id="nome_cliente"
                    value={form.nome_cliente}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nome_cliente: e.target.value }))
                    }
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="numero_empenho">Número do empenho</Label>
                  <Input
                    id="numero_empenho"
                    value={form.numero_empenho}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, numero_empenho: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="numero_autorizacao_fornecimento">
                    Nº autorização do fornecimento
                  </Label>
                  <Input
                    id="numero_autorizacao_fornecimento"
                    value={form.numero_autorizacao_fornecimento}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        numero_autorizacao_fornecimento: e.target.value,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={cardFormClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  Prazos de entrega
                </CardTitle>
                
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="empenho_recebido">Empenho recebido</Label>
                  <Input
                    id="empenho_recebido"
                    type="date"
                    value={form.empenho_recebido}
                    onChange={(e) => {
                      const empenho_recebido = e.target.value;
                      setForm((f) => ({
                        ...f,
                        empenho_recebido,
                        data_para_entregar: calcularDataSomandoPrazo(
                          empenho_recebido,
                          f.prazo_entrega
                        ),
                      }));
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="prazo_entrega">Prazo para a entrega (dias)</Label>
                  <Input
                    id="prazo_entrega"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.prazo_entrega}
                    onChange={(e) => {
                      const prazo_entrega = e.target.value;
                      setForm((f) => ({
                        ...f,
                        prazo_entrega,
                        data_para_entregar: calcularDataSomandoPrazo(
                          f.empenho_recebido,
                          prazo_entrega
                        ),
                      }));
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="data_para_entregar">Data para entregar</Label>
                  <Input
                    id="data_para_entregar"
                    type="date"
                    value={form.data_para_entregar}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        data_para_entregar: e.target.value,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={cardFormClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  Prorrogação e situação
                </CardTitle>
                
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="pedido_prorrogacao">
                      Pedido de prorrogação
                    </Label>
                    <Input
                      id="pedido_prorrogacao"
                      type="date"
                      value={form.pedido_prorrogacao}
                      onChange={(e) => {
                        const pedido_prorrogacao = e.target.value;
                        setForm((f) => {
                          const data_nova_para_entregar = calcularDataSomandoPrazo(
                            pedido_prorrogacao,
                            f.dias_prorrogacao
                          );
                          return {
                            ...f,
                            pedido_prorrogacao,
                            data_nova_para_entregar,
                            ...(data_nova_para_entregar.trim() !== ""
                              ? { status: "PRORROGADO" as const }
                              : {}),
                          };
                        });
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dias_prorrogacao">
                      Dias de prorrogação
                    </Label>
                    <Input
                      id="dias_prorrogacao"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={form.dias_prorrogacao}
                      onChange={(e) => {
                        const dias_prorrogacao = e.target.value;
                        setForm((f) => {
                          const data_nova_para_entregar = calcularDataSomandoPrazo(
                            f.pedido_prorrogacao,
                            dias_prorrogacao
                          );
                          return {
                            ...f,
                            dias_prorrogacao,
                            data_nova_para_entregar,
                            ...(data_nova_para_entregar.trim() !== ""
                              ? { status: "PRORROGADO" as const }
                              : {}),
                          };
                        });
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="data_nova_para_entregar">
                      Nova data para entregar
                    </Label>
                    <Input
                      id="data_nova_para_entregar"
                      type="date"
                      value={form.data_nova_para_entregar}
                      onChange={(e) => {
                        const data_nova_para_entregar = e.target.value;
                        setForm((f) => ({
                          ...f,
                          data_nova_para_entregar,
                          ...(data_nova_para_entregar.trim() !== ""
                            ? { status: "PRORROGADO" as const }
                            : {}),
                        }));
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="observacao">Observação</Label>
                  <Textarea
                    id="observacao"
                    rows={4}
                    value={form.observacao}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, observacao: e.target.value }))
                    }
                    className="min-h-[100px] resize-y"
                  />
                </div>
                <div className="grid max-w-xs gap-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        status: v as StatusNotificacao,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full min-w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_NOTIFICACAO.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Salvando…"
                  : editingId !== null
                    ? "Salvar alterações"
                    : "Cadastrar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTab("lista")}
              >
                Voltar para a lista
              </Button>
            </div>
          </form>
          </div>
        )}
      </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Excluir notificação?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O registro de{" "}
              <strong>{deleteTarget?.nome_cliente}</strong> será removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
