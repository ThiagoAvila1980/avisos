import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "notificacoes.db");

let db: Database.Database | null = null;

/** Erro quando o addon nativo foi compilado para outra versão do Node (ABI diferente). */
export class SqliteModuleError extends Error {
  constructor() {
    super(
      "SQLite: o módulo nativo (better-sqlite3) não corresponde ao Node.js em uso. Pare o servidor, execute na pasta do projeto: npm rebuild better-sqlite3 e inicie de novo com npm run dev."
    );
    this.name = "SqliteModuleError";
  }
}

function initSchema(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS push_subscription (
      endpoint TEXT PRIMARY KEY,
      auth TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS notificacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_cliente TEXT NOT NULL,
      numero_empenho TEXT,
      numero_autorizacao_fornecimento TEXT,
      empenho_recebido TEXT,
      prazo_entrega INTEGER,
      data_para_entregar TEXT,
      pedido_prorrogacao TEXT,
      dias_prorrogacao INTEGER,
      data_nova_para_entregar TEXT,
      observacao TEXT,
      status TEXT NOT NULL DEFAULT 'PENDENTE'
        CHECK(status IN ('PENDENTE', 'PRORROGADO', 'ENTREGUE'))
    );
  `);
}

export function getDb() {
  if (!db) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    try {
      db = new Database(dbPath);
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "ERR_DLOPEN_FAILED") {
        throw new SqliteModuleError();
      }
      throw e;
    }
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}
