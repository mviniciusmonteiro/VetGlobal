import React, { useState } from 'react';
import type { DocumentDetails } from '../types';
import { AlertTriangle, Copy, Check, RotateCcw, ShieldCheck, Printer } from 'lucide-react';

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

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' · ' + d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <section
      aria-label="Laudo Clínico Veterinário"
      className={`clinical-sheet rounded-xl overflow-hidden transition-all duration-300 ${isReady
        ? 'border-emerald-300 ring-1 ring-emerald-500/20'
        : isFailed
          ? 'border-rose-300'
          : 'border-slate-200'
        }`}
    >

      <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-emerald-700 font-semibold">
            <ShieldCheck size={14} className="text-emerald-600" /> VetGlobal · Avaliação e Sumarização Clínica
          </div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight mt-0.5">
            {isReady ? 'Parecer Clínico Consolidado' : 'Interrupção no Processamento'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {isReady && (
            <>
              <button
                id="btn-copy-summary"
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shadow-2xs"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copied ? 'Laudo Copiado' : 'Copiar Laudo'}
              </button>
              <button
                id="btn-print-summary"
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shadow-2xs"
                title="Imprimir ou Salvar PDF"
              >
                <Printer size={13} />
                Imprimir
              </button>
            </>
          )}

          <button
            id="btn-new-document"
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
          >
            <RotateCcw size={13} />
            Novo Registro
          </button>
        </div>
      </div>

      <div className="px-6 py-3 bg-slate-50/40 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600">
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Identificador</span>
          <span className="font-mono text-slate-900 font-medium">#DOC-{document.id}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Arquivo</span>
          <span className="text-slate-900 truncate block font-medium" title={document.filename}>
            {document.filename}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Tempo Analítico</span>
          <span className="font-mono text-emerald-700 font-semibold">
            {document.duration_ms !== null ? `${document.duration_ms} ms` : 'Processando'}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Data de Emissão</span>
          <span className="text-slate-900 font-medium">{formatDate(document.completed_at)}</span>
        </div>
      </div>

      <div className="p-7 bg-white">
        {isReady && document.summary && (
          <article className="space-y-4">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold pb-2 border-b border-slate-200 flex items-center justify-between">
              <span>Síntese Diagnóstica e Conduta Terapêutica</span>
              <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Laudo Finalizado
              </span>
            </div>

            <div className="font-editorial text-slate-800 text-lg sm:text-[1.18rem] leading-[1.8] whitespace-pre-line tracking-normal">
              {document.summary}
            </div>

            <div className="pt-5 border-t border-slate-200 text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <span>Documento validado pelo pipeline assíncrono de triagem e sumarização VetGlobal.</span>
              <span className="font-mono text-[11px] text-slate-400">Hash Job: #{document.id}</span>
            </div>
          </article>
        )}

        {isFailed && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-medium text-sm">
              <AlertTriangle size={18} className="text-rose-600" />
              Falha na extração ou formatação do documento
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-800 text-xs sm:text-sm leading-relaxed">
              {document.error || 'O arquivo enviado não pôde ser interpretado pelo leitor de documentos. Verifique a integridade do arquivo .pdf ou .txt.'}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
