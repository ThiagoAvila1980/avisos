"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BellIcon, BellOffIcon, SendIcon } from "lucide-react";

import { apiUrl } from "@/lib/api-base";
import { urlBase64ToUint8Array } from "@/lib/push-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PUSH_TEST_SECRET_STORAGE_KEY = "avisos-push-test-secret";

export function PushNotificationsCard() {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";

  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testSecret, setTestSecret] = useState("");
  const [testTitle, setTestTitle] = useState("Avisos - teste");
  const [testBody, setTestBody] = useState("Notificação push de teste.");

  const refreshSubscriptionState = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void refreshSubscriptionState();
  }, [refreshSubscriptionState]);

  /** Restaura o token guardado neste navegador (útil no telemóvel após colar uma vez). */
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PUSH_TEST_SECRET_STORAGE_KEY);
      if (saved) setTestSecret(saved);
    } catch {
      /* sessionStorage indisponível */
    }
  }, []);

  useEffect(() => {
    try {
      if (testSecret.trim()) {
        sessionStorage.setItem(PUSH_TEST_SECRET_STORAGE_KEY, testSecret.trim());
      }
    } catch {
      /* ignorar */
    }
  }, [testSecret]);

  async function handleSubscribe() {
    if (!vapidPublic) {
      toast.error("Chave VAPID pública não configurada no servidor (.env).");
      return;
    }
    setBusy(true);
    try {
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Permissão de notificação negada.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const appKey = urlBase64ToUint8Array(vapidPublic);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appKey as BufferSource,
        });
      }

      const payload = sub.toJSON();
      const res = await fetch(apiUrl("/api/push/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setSubscribed(true);
      toast.success("Notificações push ativadas neste dispositivo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao subscrever.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await fetch(apiUrl("/api/push/subscribe"), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notificações desativadas neste dispositivo.");
    } catch {
      toast.error("Erro ao cancelar subscrição.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendTest() {
    const secret = testSecret.trim();
    if (!secret) {
      toast.error(
        "Cole o token no campo acima: é o mesmo texto que definiste como PUSH_TEST_SECRET no .env do servidor (copia no PC e cola aqui no telemóvel)."
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/push/test"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          title: testTitle.trim() || undefined,
          body: testBody.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        sent?: number;
        removedStale?: number;
        failed?: number;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(
        `Envio concluído: ${data.sent ?? 0} enviada(s)${
          data.removedStale ? `, ${data.removedStale} subscrição(ões) expirada(s)` : ""
        }.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar teste.");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return (
      <Card className="mx-auto mt-8 w-full max-w-xl">
        <CardHeader>
          <CardTitle>Push</CardTitle>
          <CardDescription>
            Este navegador não suporta notificações push ou service worker.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto mt-8 w-full max-w-xl border-dashed">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellIcon className="size-5" aria-hidden />
            Notificações push
          </CardTitle>
          {subscribed ? (
            <Badge variant="secondary">Ativo neste dispositivo</Badge>
          ) : (
            <Badge variant="outline">Inativo</Badge>
          )}
        </div>
        <CardDescription>
          Permite à VPS enviar alertas mesmo com o separador em segundo plano.
          Configure VAPID no servidor e use o botão de teste com{" "}
          <code className="rounded bg-muted px-1 text-xs">PUSH_TEST_SECRET</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!vapidPublic && (
          <p className="text-sm text-destructive">
            Falta{" "}
            <code className="rounded bg-muted px-1 text-xs">
              NEXT_PUBLIC_VAPID_PUBLIC_KEY
            </code>{" "}
            no build. Execute{" "}
            <code className="rounded bg-muted px-1 text-xs">
              npm run push:keys
            </code>{" "}
            e copie as variáveis para{" "}
            <code className="rounded bg-muted px-1 text-xs">.env.local</code>.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {permission === "denied" ? (
            <p className="text-sm text-muted-foreground">
              Permissões de notificação foram bloqueadas neste navegador.
              Ative-as nas definições do site.
            </p>
          ) : subscribed ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void handleUnsubscribe()}
            >
              <BellOffIcon className="mr-2 size-4" />
              Desativar neste dispositivo
            </Button>
          ) : (
            <Button
              type="button"
              disabled={busy || !vapidPublic}
              onClick={() => void handleSubscribe()}
            >
              <BellIcon className="mr-2 size-4" />
              Ativar notificações push
            </Button>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium">Enviar teste pela API</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            No PC, abre o ficheiro <code className="rounded bg-muted px-1">.env.local</code>{" "}
            (ou o env na VPS) e copia o valor de{" "}
            <code className="rounded bg-muted px-1">PUSH_TEST_SECRET</code>. Cola no
            campo abaixo — no telemóvel o valor fica guardado neste aparelho até fechares
            o separador.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="push-test-secret">
              Token de teste (<code>PUSH_TEST_SECRET</code>)
            </Label>
            <Input
              id="push-test-secret"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Cola aqui o mesmo texto do PUSH_TEST_SECRET no servidor"
              value={testSecret}
              onChange={(e) => setTestSecret(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="push-test-title">Título</Label>
              <Input
                id="push-test-title"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="push-test-body">Texto</Label>
              <Input
                id="push-test-body"
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void handleSendTest()}
          >
            <SendIcon className="mr-2 size-4" />
            Disparar notificação de teste
          </Button>
          <p className="text-xs text-muted-foreground">
            Em produção, restrinja ou remova esta rota; quem souber o token pode
            enviar push para todas as subscrições registadas.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
