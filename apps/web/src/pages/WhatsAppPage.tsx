import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import { Plus } from "lucide-react";
import useSWR from "swr";
import { PullToRefresh } from "../components/ui/pull-to-refresh";
import { WaSession } from "../types";
import { SessionCard } from "../components/whatsapp/SessionCard";
import { useState } from "react";
import { QRCodeModal } from "../components/whatsapp/QRCodeModal";

export function WhatsAppPage() {
  const { data, mutate } = useSWR('/wa/sessions');
  const sessions: WaSession[] = data?.sessions || [];

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const handleOpenQR = (id: string) => {
    setSelectedSessionId(id);
    setIsQRModalOpen(true);
  };

  return (
    <PullToRefresh onRefresh={() => mutate()}>
    <div className="flex flex-col gap-6">
      <Header title="WhatsApp" showNewPromo={false} />

      <div className="flex items-center justify-between px-4 sm:px-6">
        <h2 className="text-lg font-semibold">Suas Sessões</h2>
        <Button className="min-h-[44px] gap-2">
          <Plus className="h-4 w-4" />
          Nova Sessão
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 sm:px-6 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onViewQR={() => handleOpenQR(session.id)}
            onRefresh={() => mutate()}
          />
        ))}
        {sessions.length === 0 && (
          <div className="col-span-full py-20 text-center text-muted-foreground">
            Nenhuma sessão do WhatsApp conectada.
          </div>
        )}
      </div>

      {selectedSessionId && (
        <QRCodeModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          sessionId={selectedSessionId}
          onConnected={() => {
            setIsQRModalOpen(false);
            mutate();
          }}
        />
      )}
    </div>
    </PullToRefresh>
  );
}
