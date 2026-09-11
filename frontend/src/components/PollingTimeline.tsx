import React from 'react';
import type { DocumentDetails } from '../types';
import { Activity, Clock, CheckCircle, XCircle, RefreshCw, AlertTriangle, RefreshCcw } from 'lucide-react';

interface PollingTimelineProps {
  documentId: number;
  jobId: number;
  isPolling: boolean;
  pollSeconds: number;
  docDetails: DocumentDetails | null;
  pollCycleCount: number;
  isTimedOut?: boolean;
  maxCycles?: number;
  isRefreshing?: boolean;
  lastCheckResult?: {
    timestamp: string;
    status: string;
    message: string;
  } | null;
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
  isRefreshing = false,
  lastCheckResult = null,
  onRetryPoll,
  onRefreshNow,
}) => {
  const status = docDetails?.status || 'ENQUEUED';
  const isWaiting = status === 'ENQUEUED' || status === 'PENDING';

  const getStatusBadge = () => {
    if (isTimedOut && isWaiting) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle size={13} className="text-amber-600" /> Aguardo em pausa
        </span>
      );
    }

    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle size={13} className="text-emerald-600" /> Análise concluída
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle size={13} className="text-rose-600" /> Falha no processamento
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <span className="pulse-indicator !w-2 !h-2" />
            {isPolling ? 'Processando em segundo plano' : 'Aguardando fila'}
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Activity size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Monitor de Processamento Clínico</h2>
            <p className="text-xs text-slate-500">
              Acompanhamento assíncrono via Long Polling em tempo real
            </p>
          </div>
        </div>

        <div>{getStatusBadge()}</div>
      </div>

      {/* Metrics Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 mb-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Prontuário</div>
            <div className="text-base font-semibold text-slate-900 font-mono mt-0.5">#{documentId}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Tarefa (Job)</div>
            <div className="text-base font-semibold text-emerald-700 font-mono mt-0.5">#{jobId}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Tempo Decorrido</div>
            <div className={`text-base font-semibold font-mono flex items-center gap-1 mt-0.5 ${isPolling ? 'text-amber-700' : 'text-slate-700'}`}>
              <Clock size={14} />
              {pollSeconds.toFixed(1)}s
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Ciclos de Consulta</div>
            <div className="text-base font-semibold text-slate-900 font-mono mt-0.5">
              {pollCycleCount} / {maxCycles}
            </div>
          </div>
        </div>

        {isPolling && (
          <div className="mt-3 pt-2.5 border-t border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-500 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="pulse-indicator" />
                <span className="font-mono text-[11px] text-slate-700">Aguardando resposta do worker</span>
              </span>
              <span className="text-[11px] text-slate-400">Timeout: 25s</span>
            </div>
            <div className="shimmer-bar" />
          </div>
        )}
      </div>

      {/* Circuit Breaker Timeout Banner */}
      {isTimedOut && isWaiting && (
        <div className="mb-3.5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-950 font-semibold">Consulta contínua pausada.</strong>
                <p className="text-amber-800 mt-0.5 leading-relaxed">
                  O arquivo continua registrado na fila. Clique em checar status para atualizar ou retome o monitoramento contínuo.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onRefreshNow && (
                <button
                  id="btn-refresh-status"
                  type="button"
                  disabled={isRefreshing}
                  onClick={onRefreshNow}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-slate-300 transition-all shadow-2xs disabled:opacity-50"
                  title="Consultar status no servidor agora"
                >
                  <RefreshCcw size={12} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
                  {isRefreshing ? 'Consultando...' : 'Checar Agora'}
                </button>
              )}
              <button
                id="btn-resume-poll"
                type="button"
                onClick={onRetryPoll}
                className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-2xs transition-all"
                title="Reconectar ciclo contínuo de polling"
              >
                <RefreshCw size={12} />
                Retomar
              </button>
            </div>
          </div>

          {/* Feedback imediato da checagem manual */}
          {lastCheckResult && (
            <div className={`mt-1 px-3 py-1.5 rounded-md text-xs flex items-center gap-2 border animate-in fade-in duration-150 ${
              lastCheckResult.status === 'READY'
                ? 'bg-emerald-100/70 text-emerald-950 border-emerald-300'
                : lastCheckResult.status === 'ERROR'
                ? 'bg-rose-100/70 text-rose-950 border-rose-300'
                : 'bg-white text-amber-950 border-amber-300/80 shadow-2xs'
            }`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                lastCheckResult.status === 'READY'
                  ? 'bg-emerald-500'
                  : lastCheckResult.status === 'ERROR'
                  ? 'bg-rose-500'
                  : 'bg-amber-500 animate-pulse'
              }`} />
              <span className="font-medium">{lastCheckResult.message}</span>
            </div>
          )}
        </div>
      )}

      {!isPolling && !isTimedOut && isWaiting && (
        <div className="mt-3 text-center">
          <button
            id="btn-retry-poll"
            type="button"
            onClick={onRetryPoll}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer"
          >
            <RefreshCw size={13} />
            Reconectar Acompanhamento
          </button>
        </div>
      )}
    </div>
  );
};
