/**
 * Arranque do servidor — agenda chamadas HTTP internas aos lembretes push,
 * sem importar SQLite/web-push aqui (o Webpack em `next dev` falhava com `fs`).
 *
 * A lógica real está em `POST /api/cron/reminders` → `runReminderPushOnce()`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const secret =
    process.env.CRON_SECRET?.trim() || process.env.PUSH_TEST_SECRET?.trim();
  if (!secret) {
    console.warn(
      "[cron] Defina CRON_SECRET ou PUSH_TEST_SECRET para lembretes agendados."
    );
    return;
  }

  const enabled = isReminderCronEnabled();
  if (!enabled) {
    console.log("[cron] Lembretes por intervalo desligados (REMINDER_PUSH_*).");
    return;
  }

  const port = process.env.PORT || "3000";
  const host = process.env.INTERNAL_CRON_HOST?.trim() || "127.0.0.1";
  const base = `http://${host}:${port}`;
  const runHours = getRunSlotHours();

  const tick = () => {
    console.log("[cron] Executando verificação de lembretes...");
    void (async () => {
      try {
        const res = await fetch(`${base}/api/cron/reminders`, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
        });
        const status = res.status;
        if (!res.ok) {
          const t = await res.text();
          console.error(`[cron] Falha na chamada HTTP (${status}):`, t.slice(0, 200));
        } else {
          console.log(`[cron] Chamada HTTP concluída com sucesso (${status}).`);
        }
      } catch (e) {
        console.error("[cron] Erro ao disparar lembrete (fetch):", e);
      }
    })();
  };

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (runHours.length === 0) {
    console.warn(
      "[cron] REMINDER_PUSH_LAST_RUN_HOUR deve ser >= REMINDER_PUSH_FIRST_RUN_HOUR — sem slots de lembrete."
    );
    return;
  }

  const firstDelay = getMsUntilNextSlot(runHours);
  const firstAt = new Date(Date.now() + firstDelay);
  const slotLabel = runHours
    .map((h) => `${String(h).padStart(2, "0")}:00`)
    .join(", ");
  console.log(
    `[cron] lembretes ${runHours.length}x/dia às ${slotLabel} (hora local do servidor; próxima em ${Math.round(firstDelay / 60000)} min → ${firstAt.toLocaleString()}) → ${base}/api/cron/reminders`
  );

  function scheduleNext() {
    const delay = getMsUntilNextSlot(runHours);
    setTimeout(() => {
      tick();
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

function isReminderCronEnabled(): boolean {
  const v = process.env.REMINDER_PUSH_ENABLED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return process.env.NODE_ENV === "production";
}

/** Intervalo entre horários dentro da janela (omissão 2 h). */
function getIntervalMs(): number {
  const raw = process.env.REMINDER_PUSH_INTERVAL_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60_000) return n;
  }
  return 2 * 60 * 60 * 1000;
}

function getFirstRunHour(): number {
  const raw = process.env.REMINDER_PUSH_FIRST_RUN_HOUR?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 23) return n;
  }
  return 8;
}

/** Última hora inclusiva da janela diária (omissão 14 → 08:00 … 14:00). */
function getLastRunHour(): number {
  const raw = process.env.REMINDER_PUSH_LAST_RUN_HOUR?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 23) return n;
  }
  return 14;
}

/**
 * Horários do dia em que corre o cron, entre FIRST e LAST, de INTERVAL em INTERVAL (ex.: 8,10,12,14).
 */
function getRunSlotHours(): number[] {
  const first = getFirstRunHour();
  const last = getLastRunHour();
  if (last < first) return [];

  const stepMs = getIntervalMs();
  const stepHours = Math.max(1, Math.round(stepMs / (60 * 60 * 1000)));
  const hours: number[] = [];
  for (let h = first; h <= last; h += stepHours) {
    if (h <= 23) hours.push(h);
  }
  return hours;
}

function getMsUntilNextSlot(runHours: number[]): number {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const hour of runHours) {
    const slot = new Date(todayStart);
    slot.setHours(hour, 0, 0, 0);
    if (slot.getTime() >= now.getTime()) {
      return slot.getTime() - now.getTime();
    }
  }

  const tomorrowFirst = new Date(todayStart);
  tomorrowFirst.setDate(tomorrowFirst.getDate() + 1);
  tomorrowFirst.setHours(runHours[0], 0, 0, 0);
  return tomorrowFirst.getTime() - now.getTime();
}
