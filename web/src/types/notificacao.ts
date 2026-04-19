export const STATUS_NOTIFICACAO = ["PENDENTE", "PRORROGADO", "ENTREGUE"] as const;
export type StatusNotificacao = (typeof STATUS_NOTIFICACAO)[number];

export type Notificacao = {
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

export type NotificacaoInput = Omit<Notificacao, "id">;
