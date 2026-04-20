"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BellIcon, BellOffIcon } from "lucide-react";

import { apiUrl } from "@/lib/api-base";
import { urlBase64ToUint8Array } from "@/lib/push-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Ativar/desativar subscrição push — sem cartão de teste nem segredo no cliente. */
export function PushSubscribeToolbar() {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";

  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

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

  async function handleSubscribe() {
    if (!vapidPublic) {
      toast.error("Alertas push não configurados no servidor (VAPID).");
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
      toast.success("Alertas ativados neste dispositivo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ativar alertas.");
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
      toast.success("Alertas desativados neste dispositivo.");
    } catch {
      toast.error("Erro ao desativar alertas.");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:max-w-[min(100%,22rem)]">
      {!vapidPublic ? (
        <span className="text-xs text-muted-foreground">
          Alertas não disponíveis (servidor sem VAPID).
        </span>
      ) : permission === "denied" ? (
        <span className="text-xs text-muted-foreground">
          Notificações bloqueadas — ative nas definições do site.
        </span>
      ) : subscribed ? (
        <>
          <Badge variant="secondary" className="font-normal">
            Alertas ativos
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="shrink-0"
            onClick={() => void handleUnsubscribe()}
          >
            <BellOffIcon className="mr-2 size-4" aria-hidden />
            Desativar alertas
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !vapidPublic}
          className="shrink-0"
          onClick={() => void handleSubscribe()}
        >
          <BellIcon className="mr-2 size-4" aria-hidden />
          Ativar alertas neste dispositivo
        </Button>
      )}
    </div>
  );
}
