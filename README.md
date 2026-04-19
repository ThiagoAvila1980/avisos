# Avisos — notificações de processos

Aplicação web para **cadastrar, pesquisar e acompanhar notificações** (cliente, empenho, prazos, prorrogação, status). O código do app fica na subpasta **`web/`** (Next.js + SQLite).

---

## Estrutura ao copiar a pasta `Avisos` inteira

```
Avisos/
├── README.md          ← este arquivo
├── imagens/           ← outros arquivos da pasta (se houver)
└── web/               ← projeto Next.js (é aqui que você instala e roda)
    ├── package.json
    ├── data/          ← banco SQLite (gravado em arquivo)
    └── ...
```

---

## Pré-requisitos na máquina nova

- **Node.js** instalado (recomendado: versão **20** ou **22** LTS).  
  Confira no terminal: `node -v` e `npm -v`.
- **Git** — necessário apenas se você for **clonar** o repositório pelo GitHub (`git --version`).

---

## Obter o projeto pelo GitHub (`git clone`)

Se o código estiver publicado (ou acessível para você) em um repositório no GitHub, use os comandos abaixo em vez de copiar a pasta manualmente.

### 1. Clonar o repositório

Abra o terminal na pasta onde deseja baixar o projeto (por exemplo `Documentos` ou `dev`).  
Substitua a URL pela do **seu** repositório (copie em **Code → HTTPS** ou **SSH** na página do GitHub).

**HTTPS** (mais simples na primeira vez):

```bash
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
cd SEU-REPOSITORIO
```

**SSH** (se você já configurou chave SSH no GitHub):

```bash
git clone git@github.com:SEU-USUARIO/SEU-REPOSITORIO.git
cd SEU-REPOSITORIO
```

- Repositório **privado**: o GitHub vai pedir autenticação (no Windows costuma abrir o navegador ou usar o *Git Credential Manager*). Com SSH, use a chave cadastrada na sua conta.

### 2. Entrar na pasta do app e instalar

Este projeto guarda o Next.js dentro de **`web/`**. Depois do `cd` no repositório:

```bash
cd web
npm install
```

Se aparecer erro do SQLite nativo:

```bash
npm rebuild better-sqlite3
```

### 3. Rodar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### 4. Banco de dados após o clone

O arquivo **`web/data/notificacoes.db`** em geral **não** vai no Git (fica no `.gitignore`).  
Depois do clone você começa com **base vazia**, a menos que alguém tenha enviado um backup da pasta `data/` por outro meio ou você copie manualmente um `.db` de outra máquina (com o servidor **parado**).

### 5. Atualizar o projeto depois (pull)

Quando houver alterações no GitHub:

```bash
cd caminho\para\SEU-REPOSITORIO
git pull
cd web
npm install
```

Depois suba de novo com `npm run dev` (ou `npm run build` / `npm run start` em produção).

---

## Instalação em outra máquina ou outra rede (cópia da pasta)

Você pode copiar a **pasta `Avisos` completa** (pendrive, rede, ZIP, etc.) em vez de usar o Git.

### 1. Antes de copiar

- **Pare o servidor** de desenvolvimento (`Ctrl+C` no terminal onde roda `npm run dev`) para o arquivo do banco não ser copiado no meio de uma gravação.

### 2. O que é importante levar

- Toda a pasta **`Avisos`**, em especial a subpasta **`web/`**.
- Para **manter os dados já cadastrados**, é obrigatório existir a pasta **`web/data/`** com o arquivo **`notificacoes.db`** (e, se aparecerem, `notificacoes.db-wal` e `notificacoes.db-shm` — fazem parte do SQLite em modo WAL).

### 3. Na máquina nova

1. Abra um terminal (PowerShell ou CMD).
2. Entre na pasta do aplicativo:

   ```bash
   cd caminho\para\Avisos\web
   ```

3. **Instale as dependências** (recomendado mesmo que você tenha copiado `node_modules`):

   ```bash
   npm install
   ```

   O projeto está configurado para recompilar o **SQLite nativo** (`better-sqlite3`) após o `npm install`. Se aparecer erro relacionado ao módulo SQLite, rode:

   ```bash
   npm rebuild better-sqlite3
   ```

4. Suba o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

5. No navegador, acesse:

   - **Nesta máquina:** [http://localhost:3000](http://localhost:3000)  
   - **Outro dispositivo na mesma rede:** use o IP da máquina, por exemplo `http://192.168.x.x:3000` (a porta é a que o terminal mostrar, em geral **3000**).

### 4. Acesso por outro computador ou celular na rede

- Libere a **porta** no firewall do Windows, se o navegador não abrir pelo IP.
- Se o Next.js avisar sobre **origem bloqueada** no modo desenvolvimento, o arquivo `web/next.config.ts` pode incluir o seu IP em `allowedDevOrigins` — ajuste conforme o IP da máquina que hospeda o app e reinicie o `npm run dev`.

---

## Comandos úteis (sempre dentro de `Avisos/web`)

| Comando | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento (hot reload). |
| `npm run build` | Gera build de produção. |
| `npm run start` | Sobe o app em modo produção (depois do `build`). |
| `npm run lint` | Executa o linter. |
| `npm run reminder:check` | Consulta prazos no SQLite e imprime no terminal (toast Windows desativado; lembretes reais via Web Push na VPS — ver abaixo). |

---

## Onde ficam os dados

- **Desenvolvimento local:** `web/data/notificacoes.db`
- **Docker na VPS:** pasta **`data/` na raiz do repositório** (ao lado de `docker-compose.yml`), montada em `/app/data` no contentor — copie para lá o seu `notificacoes.db` antes ou depois do primeiro arranque (com o contentor parado ao substituir o ficheiro).
- Os dados **não** ficam só na memória: o cadastro permanece desde que o ficheiro `.db` (e o volume/pasta corretos) sejam preservados.

---

## Problemas comuns

| Situação | O que fazer |
|----------|-------------|
| Erro do **better-sqlite3** / NODE_MODULE_VERSION | Rode `npm rebuild better-sqlite3` na pasta `web`, com o mesmo Node que você usa para o `npm run dev`. |
| Página abre mas a API retorna erro 500 / 503 | Geralmente SQLite incompatível com a versão do Node — mesmo procedimento acima. |
| Copiei só o código e **sumiram os registros** | A pasta `web/data` (e o `.db`) não foi copiada ou não estava no backup. |

---

## Lembretes de prazo (Web Push na VPS)

Os lembretes automáticos **não** dependem mais do toast do Windows: com o servidor em produção (`npm run build` seguido de `npm run start`), o Next.js carrega `src/instrumentation.ts`, que agenda verificações periódicas e envia **notificações push** aos navegadores que ativaram push na app (mesma janela de datas que antes: registros **PENDENTE** ou **PRORROGADO** com data de referência entre **hoje** e **hoje+2** dias).

### Configuração

- Copie `web/.env.example` para `web/.env.local` na VPS e preencha pelo menos **VAPID** (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) e origens/API conforme o seu domínio.
- Opcional: `REMINDER_PUSH_ENABLED`, `REMINDER_PUSH_INTERVAL_MS` (intervalo entre verificações; omissão ~2 horas em produção).
- Estado para não repetir o mesmo aviso no mesmo dia (lista de IDs): `web/data/reminder-push-state.json` (ignorado pelo Git).

### Processo único na VPS

Use **um único processo** Node (por exemplo PM2 em modo `fork` com **1 instância** — ver `web/ecosystem.config.cjs`). Vários workers duplicariam o agendador e podem causar contenção no SQLite.

### Fluxo típico após `git pull` na VPS

```bash
cd web
npm ci
npm run build
# Reinicie o serviço (ex.: pm2 restart avisos-web) ou npm run start atrás do reverse proxy.
```

### Docker (Coolify / imagem)

- **Coolify** (e outros que fazem `docker build` na raiz): usa o **`Dockerfile` na raiz** do repositório; não é preciso apontar para `web/`.
- **`docker compose`** local continua a usar `web/Dockerfile` com contexto `./web` (ficheiro `docker-compose.yml`).

### Docker (imagem em `web/Dockerfile` — compose local)

Na raiz do clone (onde está `docker-compose.yml`):

1. Copie o ficheiro **`notificacoes.db`** (e, se existirem, `notificacoes.db-wal` / `notificacoes.db-shm`) para **`data/`** — a pasta `data/` na raiz é montada no contentor como `/app/data`, onde a app grava o SQLite.
2. Crie **`.env`** na raiz a partir de `.env.example` (mesmas variáveis que `web/.env.example`: VAPID, `ALLOWED_ORIGINS`, etc.).
3. Suba o serviço:

```bash
docker compose up -d --build
```

A app fica na porta **3000**. Para atualizar código: `git pull`, depois `docker compose up -d --build` de novo. O **processo único** continua a ser um contentor (não escale réplicas com o mesmo volume SQLite).

### CI no GitHub

O workflow `.github/workflows/ci-web.yml` executa `npm ci` e `npm run build` em `web/` quando há alterações nessa pasta — útil a validar antes de implantar.

---

## Windows: desenvolvimento local e script legado

Para desenvolvimento no PC, `web/iniciar-servidor-dev.bat` executa `npm run dev` (pode-se colocar um atalho em `shell:startup` se quiser subir o app ao iniciar sessão).

| Arquivo | Função |
|--------|--------|
| `scripts/check-entregas-reminder.cjs` | Lê o SQLite com as **mesmas regras** de prazo que o servidor usa para push; o **toast Windows está desativado** (código comentado para eventual reativação). Só **regista no terminal** e mantém deduplicação por dia. |
| `scripts/verificar-entregas.bat` | Chama o script acima com a pasta `web` correta. |
| `iniciar-servidor-dev.bat` | Sobe o Next em modo desenvolvimento. |

Comando manual (na pasta `web`):

```bash
npm run reminder:check
```

- Se a lista de IDs for **idêntica** à última execução **no mesmo dia**, o script **omite** a saída longa (use `--always` para repetir): `npm run reminder:check -- --always`.
- Estado legado do toast: `web/data/reminder-toast-state.json` (ignorado pelo Git).

Se ainda quiser disparar o `.bat` pelo **Agendador de Tarefas** só para ver logs no histórico da tarefa, pode — mas os lembretes ao utilizador passam a ser os **push** quando a app está servida na VPS com VAPID e subscrições ativas.

**Nota:** com `npm run dev` a correr, o SQLite em modo WAL costuma permitir **leitura** em paralelo (o script abre só leitura). Em caso de bloqueio ocasional, evite coincidir com picos de escrita ou use `npm run start` em produção.

---

## Tecnologias (resumo)

- **Next.js** (React), **Tailwind CSS**, componentes **shadcn/ui**
- **SQLite** em arquivo local (`better-sqlite3`)
- **Docker** — `web/Dockerfile` (output `standalone`) e `docker-compose.yml` na raiz com volume para `notificacoes.db`
- **web-push** (VAPID) — notificações push no navegador; lembretes agendados no servidor via `instrumentation.ts`
- **node-notifier** — opcional / legado (toast Windows comentado em `check-entregas-reminder.cjs`)

---

*Em produção na internet, use HTTPS no domínio da app (requisito habitual para push e PWA). O `notificacoes.db` continua local ao servidor; faça cópias de segurança da pasta `web/data/` quando fizer sentido.*
