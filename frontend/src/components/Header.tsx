import React from 'react';
import { PawPrint, ExternalLink } from 'lucide-react';

interface HeaderProps {
  backendStatus: 'online' | 'offline' | 'checking';
}

export const Header: React.FC<HeaderProps> = ({ backendStatus }) => {
  return (
    <header className="w-full bg-[#064e3b] text-white border-b border-emerald-950/60 px-6 py-2.5 sticky top-0 z-30 shadow-sm">
      <div className="w-full flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shadow-inner">
            <PawPrint size={20} className="stroke-[2.2]" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-base font-extrabold text-white tracking-tight">
              VetGlobal
            </h1>
            <span className="text-[11px] font-medium tracking-wide text-emerald-200/80 hidden sm:inline">
              Diagnóstico & Triagem Clínica
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${backendStatus === 'online'
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30 shadow-2xs'
              : 'bg-rose-950/70 text-rose-300 border-rose-500/30'
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
            />
            {backendStatus === 'online' ? 'Serviço Conectado (Port 8000)' : 'API Desconectada'}
          </div>

          <a
            id="link-swagger-docs"
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white border border-white/15 rounded-lg px-3 py-1 text-xs font-medium transition-all shadow-2xs"
          >
            Swagger UI <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </header>
  );
};
