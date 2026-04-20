import { NextResponse } from "next/server";
import { runReminderPushOnce } from "@/lib/reminder-push";

/** Mesmo segredo que testes push — ou defina CRON_SECRET dedicado. */
function authorize(request: Request): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.PUSH_TEST_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Dispara uma verificação de prazos + envio push (chamado pelo próprio servidor
 * via `instrumentation.ts`, ou por Coolify/cron externo).
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    await runReminderPushOnce();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/cron/reminders]", e);
    return NextResponse.json({ error: "Falha ao executar lembretes." }, { status: 500 });
  }
}
