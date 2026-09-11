import React from 'react';
import type { DocumentDetails } from '../services/api';
import { Activity, Clock, Server, CheckCircle, XCircle, RefreshCw, AlertTriangle, RefreshCcw } from 'lucide-react';

interface PollingTimelineProps {
  documentId: number;
  jobId: number;
  isPolling: boolean;
  pollSeconds: number;
  docDetails: DocumentDetails | null;
  pollCycleCount: number;
  isTimedOut?: boolean;
  maxCycles?: number;
  onRetryPoll: () => void;
  onRefreshNow?: () => void;
}

export const PollingTimeline: React.FC<PollingTimelineProps> = ({
  documentId,
  jobId,
  isPolling,
  pollSeconds,
  docDetails,
  pollCycleCount,
  isTimedOut = false,
  maxCycles = 4,
  onRetryPoll,
  onRefreshNow,
}) => {
  const status = docDetails?.status || 'ENQUEUED';

  const getStatusBadge = () => {
    if (isTimedOut && status === 'ENQUEUED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <AlertTriangle size={14} className="text-amber-400" /> TIMEOUT (PAUSADO)
        </span>
      );
    }

    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/20">
            <CheckCircle size={14} /> READY (Concluído)
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle size={14} /> FAILED (Falhou)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="pulse-indicator !w-2 !h-2" />
            {isPolling ? 'ENQUEUED (Em Long Polling...)' : 'AGUARDANDO'}
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/75 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-6 transition-all duration-200 hover:border-white/20">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">3. Rastreamento e Long Polling</h2>
            <p className="text-xs text-slate-400">
              Acompanhamento assíncrono stateless em tempo real
            </p>
          </div>
        </div>

        <div>{getStatusBadge()}</div>
      </div>

      {/* Timeline tracker box */}
      <div className="bg-slate-950/70 border border-white/10 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Document ID</div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">#{documentId}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Job ID</div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">#{jobId}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tempo Decorrido</div>
            <div className={`text-xl font-bold font-mono flex items-center gap-1.5 mt-0.5 ${isPolling ? 'text-amber-400' : 'text-slate-300'}`}>
              <Clock size={16} />
              {pollSeconds.toFixed(1)}s
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Ciclo Polling</div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">
              {pollCycleCount} / {maxCycles}
            </div>
          </div>
        </div>

        {isPolling && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-2">
                <span className="pulse-indicator" />
                <span className="font-mono text-[11px]">GET /documents/{documentId}/poll?after_job_id={jobId}</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Limite máx: 25s</span>
            </div>
            <div className="shimmer-bar" />
          </div>
        )}
      </div>

      {/* Circuit Breaker Timeout Banner */}
      {isTimedOut && status === 'ENQUEUED' && (
        <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-200">Circuito de Espera Pausado ({maxCycles} ciclos / ~100s).</strong>
              <p className="text-amber-400/80 mt-0.5 leading-relaxed">
                O polling automático foi pausado para evitar loop infinito de rede. O documento continua na fila em segundo plano.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRefreshNow && (
              <button
                id="btn-refresh-status"
                type="button"
                onClick={onRefreshNow}
                className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-white/10 transition-all"
              >
                <RefreshCcw size={12} />
                Checar Agora
              </button>
            )}
            <button
              id="btn-resume-poll"
              type="button"
              onClick={onRetryPoll}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-sm transition-all"
            >
              <RefreshCw size={12} />
              Retomar Polling
            </button>
          </div>
        </div>
      )}

      {/* Architectural explanation note for technical evaluation */}
      <div className="flex items-start gap-3 text-xs text-slate-300 bg-white/[0.02] p-3.5 rounded-xl border border-white/10">
        <Server size={18} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white">Arquitetura Stateless Ativa: </strong>
          A conexão HTTP permanece suspensa no Starlette Event Loop (<code className="text-emerald-300 bg-emerald-950/40 px-1 py-0.5 rounded">await asyncio.sleep</code>) sem consumir threads do worker pool. 
          O PostgreSQL é a única fonte da verdade, permitindo escalabilidade horizontal sem sessão compartilhada.
        </div>
      </div>

      {!isPolling && !isTimedOut && status === 'ENQUEUED' && (
        <div className="mt-4 text-center">
          <button
            id="btn-retry-poll"
            type="button"
            onClick={onRetryPoll}
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 hover:border-white/30 rounded-xl px-4 py-2 text-xs font-medium transition-all cursor-pointer"
          >
            <RefreshCw size={14} />
            Reconectar Long Polling
          </button>
        </div>
      )}
    </div>
  );
};
