#!/usr/bin/env node
/**
 * Gera um par VAPID para Web Push.
 * Copie as linhas para .env.local e reinicie o servidor Next.
 *
 * Também precisa definir PUSH_TEST_SECRET (livre, forte) para POST /api/push/test.
 */
const webpush = require("web-push");

const keys = webpush.generateVAPIDKeys();
console.log("");
console.log("# Cole no .env.local ou na VPS:");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:teu-email@exemplo.com`);
console.log(`PUSH_TEST_SECRET=uma-string-secreta-longa-so-para-testes`);
console.log("");
