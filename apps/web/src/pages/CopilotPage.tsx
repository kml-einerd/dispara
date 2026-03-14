import { ChatCopilot } from '../components/copilot/ChatCopilot';
import { Sparkles } from 'lucide-react';

export function CopilotPage() {
  return (
    <div className="flex h-screen flex-col">
      {/* header fixo */}
      <div className="flex items-center gap-3 border-b border-border/50 bg-card/80 px-6 py-4 backdrop-blur">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-none">Copiloto</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pesquise produtos, cole links ou envie fotos para gerar anúncios
          </p>
        </div>
      </div>

      {/* chat ocupa o resto */}
      <div className="flex-1 overflow-hidden">
        <ChatCopilot />
      </div>
    </div>
  );
}
