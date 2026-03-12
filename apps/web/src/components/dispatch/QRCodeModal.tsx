'use client';

import { useEffect, useState, useRef } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { api } from '@/lib/api';

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  onConnected: () => void;
}

export function QRCodeModal({ open, onClose, sessionId, onConnected }: QRCodeModalProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('CONNECTING');
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || !sessionId) return;

    setQr(null);
    setStatus('CONNECTING');
    setError(null);

    const poll = async () => {
      try {
        const res = await api.getSessionQr(sessionId);
        setQr(res.qr);
        setStatus(res.status);

        if (res.status === 'CONNECTED') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onConnected();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar QR code');
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, sessionId, onConnected]);

  return (
    <Dialog open={open} onClose={onClose} title="Conectar WhatsApp" className="max-w-md">
      <div className="flex flex-col items-center gap-4">
        {status === 'CONNECTED' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Conectado!</h3>
            <p className="text-sm text-gray-500 mt-1">Sessao WhatsApp conectada com sucesso.</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : qr ? (
          <>
            <p className="text-sm text-gray-600 text-center">
              Escaneie o QR code com o WhatsApp no seu celular
            </p>
            <div className="p-4 bg-white rounded-xl border border-gray-200">
              {/* QR code is a data URL from Baileys */}
              <img
                src={qr}
                alt="QR Code WhatsApp"
                className="w-64 h-64 object-contain"
              />
            </div>
            <p className="text-xs text-gray-400">O QR code expira em 60 segundos</p>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center gap-3">
            <svg
              className="animate-spin h-8 w-8 text-indigo-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-500">Gerando QR code...</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
