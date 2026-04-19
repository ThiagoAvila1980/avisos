/**
 * Executado ao iniciar o servidor Node (`next start`, `next dev`).
 * Agenda verificação periódica de prazos + envio Web Push (VPS).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startReminderPushScheduler } = await import("@/lib/reminder-push");
  startReminderPushScheduler();
}
