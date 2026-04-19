import { NotificacoesApp } from "@/components/notificacoes/notificacoes-app";
import { PushNotificationsCard } from "@/components/push-notifications";

export default function Home() {
  return (
    <>
      <NotificacoesApp />
      <PushNotificationsCard />
    </>
  );
}
