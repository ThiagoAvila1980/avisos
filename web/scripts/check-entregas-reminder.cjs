/**
 * [DESATIVADO — apenas consulta ao SQLite / log]
 * Toast Windows (node-notifier) foi desativado em favor das notificações Web Push
 * no servidor (`src/lib/reminder-push.ts` + `instrumentation.ts`). O bloco `notifier.notify`
 * fica comentado abaixo para reativar numa máquina Windows se precisar.
 *
 * Regras (iguais ao push na VPS):
 * - Status PENDENTE ou PRORROGADO (nunca ENTREGUE).
 * - PENDENTE: usa só data_para_entregar em [hoje, hoje+2] (inclusive).
 * - PRORROGADO: usa só data_nova_para_entregar em [hoje, hoje+2] (inclusive).
 *
 * Uso: node scripts/check-entregas-reminder.cjs [--always]
 *   --always  força o toast a cada execução (sem deduplicar no mesmo dia).
 *
 * Diretório de trabalho: pasta web/ (o .bat garante).
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
// const notifier = require("node-notifier");

const webRoot = path.join(__dirname, "..");
const dbPath = path.join(webRoot, "data", "notificacoes.db");
const statePath = path.join(webRoot, "data", "reminder-toast-state.json");

const alwaysNotify = process.argv.includes("--always");

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadState() {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(day, signature) {
  try {
    fs.writeFileSync(
      statePath,
      JSON.stringify({ day, signature, updatedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  } catch (e) {
    console.error("Aviso: não foi possível gravar estado do lembrete:", e.message);
  }
}

function main() {
  if (!fs.existsSync(dbPath)) {
    console.error("Banco não encontrado:", dbPath);
    process.exit(1);
  }

  let db;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (e) {
    console.error("Erro ao abrir SQLite:", e.message);
    process.exit(1);
  }

  const sql = `
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

  let rows;
  try {
    rows = db.prepare(sql).all();
  } catch (e) {
    console.error("Erro na consulta:", e.message);
    db.close();
    process.exit(1);
  }
  db.close();

  if (rows.length === 0) {
    console.log(
      "Nenhum registro PENDENTE/PRORROGADO com data na janela hoje … hoje+2."
    );
    process.exit(0);
  }

  const signature = rows
    .map((r) => String(r.id))
    .sort((a, b) => Number(a) - Number(b))
    .join(",");

  const day = todayLocal();
  if (!alwaysNotify) {
    const prev = loadState();
    if (prev && prev.day === day && prev.signature === signature) {
      console.log(
        "Mesmo conjunto de avisos já processado hoje — omitindo (use --always para repetir)."
      );
      process.exit(0);
    }
  }

  const lines = rows.map((r) => {
    const nome = (r.nome_cliente || "(sem nome)").slice(0, 44);
    const ref = r.data_referencia || "—";
    return `• ${nome} — ${r.status} — ${ref}`;
  });
  const message =
    lines.length > 8
      ? lines.slice(0, 8).join("\n") + `\n… e mais ${lines.length - 8} registro(s).`
      : lines.join("\n");

  /*
  notifier.notify(
    {
      title: "Avisos — prazos (hoje a +2 dias)",
      message: `${rows.length} registro(s):\n${message}`,
      wait: false,
      sound: true,
      appName: "Avisos.Prazos",
    },
    (err) => {
      if (err) {
        console.error("node-notifier:", err.message);
        process.exit(1);
        return;
      }
      if (!alwaysNotify) {
        saveState(day, signature);
      }
      console.log(`Toast enviado para ${rows.length} registro(s).`);
      process.exit(0);
    }
  );
  */

  console.log(
    `[check-entregas-reminder] Toast Windows desativado. ${rows.length} registro(s) na janela:\n${message}`
  );
  if (!alwaysNotify) {
    saveState(day, signature);
  }
  process.exit(0);
}

main();
