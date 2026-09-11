import React, { useState } from 'react';
import { simulateWorker } from '../services/api';
import { Cpu, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface WorkerSimulatorPanelProps {
  jobId: number | null;
  onWorkerSimulated: () => void;
}

export const WorkerSimulatorPanel: React.FC<WorkerSimulatorPanelProps> = ({
  jobId,
  onWorkerSimulated,
}) => {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'neutral'>('neutral');

  const handleSimulateSuccess = async () => {
    if (!jobId) return;
    setLoading(true);
    setFeedback(null);
    try {
      const summaryText = 
        "Paciente canino com histórico de episódios intermitentes de vômito e letargia nos últimos 3 dias.\n" +
        "Ao exame físico e análise de prontuário, constatam-se mucosas normocoradas e discreta dor à palpação abdominal cranial.\n\n" +
        "Conduta Terapêutica Sugerida:\n" +
        "1. Dieta enteral hiperdigerível fracionada em pequenas porções.\n" +
        "2. Omeprazol 1 mg/kg SID por via oral por 10 dias.\n" +
        "3. Monitoramento da curva de hidratação e retorno em 5 dias ou antes caso persistam episódios eméticos.";
      
      const res = await simulateWorker(jobId, 'DONE', summaryText);
      setFeedback(`Worker concluiu a tarefa #${jobId} com sucesso. Status: ${res.document_status}`);
      setFeedbackType('success');
      onWorkerSimulated();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao simular worker.');
      setFeedbackType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateFailure = async () => {
    if (!jobId) return;
    setLoading(true);
    setFeedback(null);
    try {
      const errorText = "Não foi possível extrair os dados clínicos: arquivo corrompido ou formato ilegível.";
      const res = await simulateWorker(jobId, 'FAILED', undefined, errorText);
      setFeedback(`Worker finalizou a tarefa #${jobId} com status FAILED. Documento: ${res.document_status}`);
      setFeedbackType('error');
      onWorkerSimulated();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao registrar falha simulada.');
      setFeedbackType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Cpu size={16} />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
              Console de Diagnóstico & Simulação do Worker
            </h3>
            <p className="text-[11px] text-slate-500">
              Ambiente de teste para simular a resolução do processamento assíncrono
            </p>
          </div>
        </div>

        {jobId ? (
          <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
            Job #{jobId}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
            Aguardando Job
          </span>
        )}
      </div>

      {!jobId && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 p-2.5 rounded-lg mb-3">
          <AlertCircle size={14} className="text-slate-400 shrink-0" />
          <span>Envie um prontuário para gerar um Job ID e habilitar a simulação imediata.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
        <button
          id="btn-simulate-success"
          type="button"
          onClick={handleSimulateSuccess}
          disabled={!jobId || loading}
          className="inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-100/80 text-emerald-800 border border-emerald-200 py-2 px-3 rounded-lg font-medium text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} className="text-emerald-600" />}
          Concluir Laudo (DONE)
        </button>

        <button
          id="btn-simulate-failure"
          type="button"
          onClick={handleSimulateFailure}
          disabled={!jobId || loading}
          className="inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-100/80 text-rose-800 border border-rose-200 py-2 px-3 rounded-lg font-medium text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} className="text-rose-600" />}
          Simular Falha (FAILED)
        </button>
      </div>

      {feedback && (
        <div className={`p-2.5 rounded-lg text-xs leading-relaxed border ${
          feedbackType === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : feedbackType === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : 'bg-slate-50 text-slate-700 border-slate-200'
        }`}>
          {feedback}
        </div>
      )}
    </div>
  );
};
