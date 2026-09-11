import React, { useState } from 'react';
import type { DocumentDetails } from '../services/api';
import { FileCheck, AlertTriangle, Clock, Calendar, HardDrive, Copy, Check, Plus } from 'lucide-react';

interface SummaryCardProps {
  document: DocumentDetails;
  onReset: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ document, onReset }) => {
  const [copied, setCopied] = useState(false);

  const isReady = document.status === 'READY';
  const isFailed = document.status === 'FAILED';

  const handleCopy = () => {
    if (document.summary) {
      navigator.clipboard.writeText(document.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('pt-BR') + ' - ' + d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`bg-slate-900/75 backdrop-blur-xl border rounded-2xl shadow-xl p-6 transition-all ${
      isReady ? 'border-emerald-500/40 shadow-emerald-500/10 shadow-2xl' : isFailed ? 'border-rose-500/40' : 'border-white/10'
    }`}>
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            isReady ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border-rose-500/20'
          }`}>
            {isReady ? <FileCheck size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              {isReady ? '4. Prontuário Clínico Sumarizado' : '4. Falha no Processamento do Documento'}
            </h2>
            <p className="text-xs text-slate-400">
              Arquivo: <span className="text-slate-300 font-medium">{document.filename}</span> (ID #{document.id})
            </p>
          </div>
        </div>

        <button
          id="btn-new-document"
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 hover:border-white/30 rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
        >
          <Plus size={14} />
          Novo Documento
        </button>
      </div>

      {/* Metrics Row (Observability) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 bg-slate-950/60 p-4 rounded-xl border border-white/10">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
            <Clock size={13} /> DURAÇÃO (JOB)
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {document.duration_ms !== null ? `${document.duration_ms} ms` : 'Em andamento'}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
            <Calendar size={13} /> CONCLUÍDO EM
          </div>
          <div className="text-xs font-semibold text-white mt-1.5 font-mono">
            {formatDate(document.completed_at)}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
            <HardDrive size={13} /> TAMANHO (BYTEA)
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {(document.file_size / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>

      {/* Summary Content or Error Box */}
      {isReady && document.summary && (
        <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-5 relative">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Resumo Consolidado (Veterinário)
            </span>
            <button
              id="btn-copy-summary"
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/15 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">
            {document.summary}
          </p>
        </div>
      )}

      {isFailed && document.error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5">
          <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
            Causa da Falha (Erro do Worker)
          </div>
          <p className="text-rose-200 text-sm leading-relaxed">
            {document.error}
          </p>
        </div>
      )}
    </div>
  );
};
