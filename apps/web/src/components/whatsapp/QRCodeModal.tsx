'use client';

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { api } from "@/src/lib/api";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onConnected: () => void;
}

export function QRCodeModal({ isOpen, onClose, sessionId, onConnected }: QRCodeModalProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('PENDING');
  const [loading, setLoading] = useState(true);

  const fetchQR = async () => {
    try {
      const data = await api.get(`/wa/sessions/${sessionId}/qr`);
      setQr(data.qr);
      setStatus(data.status);
      
      if (data.status === 'CONNECTED') {
        onConnected();
      }
    } catch (error) {
      console.error('Failed to fetch QR', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQR();
      const interval = setInterval(fetchQR, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, sessionId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>
            Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie o código abaixo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-8">
          {loading ? (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          ) : qr ? (
            <div className="relative rounded-xl bg-white p-4">
              <img src={qr} alt="WhatsApp QR Code" className="h-64 w-64" />
              {status === 'CONNECTED' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90">
                  <div className="flex flex-col items-center gap-2 text-emerald-500">
                    <RefreshCw className="h-12 w-12 animate-spin" />
                    <span className="font-bold">Conectado! Sincronizando...</span>
                  </div>
                </div>
              )}
            </div>
          ) : status === 'CONNECTED' ? (
            <div className="flex flex-col items-center gap-2 text-emerald-500">
              <span className="font-bold">Conectado!</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
              <p>QR expirado ou indisponível.</p>
              <Button variant="outline" onClick={fetchQR}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Gerar novo QR
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
