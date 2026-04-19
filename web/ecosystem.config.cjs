/**
 * Exemplo PM2 na VPS (Ubuntu): `pm2 start ecosystem.config.cjs`
 * - Um único processo (SQLite + agendador em instrumentation.ts).
 * - Na pasta web/: copie .env.example → .env.local e preencha VAPID, secrets, etc.
 */
module.exports = {
  apps: [
    {
      name: "avisos-web",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
