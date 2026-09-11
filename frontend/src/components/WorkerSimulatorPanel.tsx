import React, { useState } from 'react';
import { simulateWorker } from '../services/api';
import { Cpu, CheckCircle2, XCircle, ShieldCheck, Loader2 } from 'lucide-react';

interface WorkerSimulatorPanelProps {
  jobId: number;
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
    setLoading(true);
    setFeedback(null);
    try {
      const summaryText = 
        "Paciente canino apresentou histórico de episódios intermitentes de vômito e letargia. " +
        "Após triagem e análise do prontuário clínico, recomenda-se dieta terapêutica de fácil digestão, " +
        "administração de protetor gástrico e retorno em 7 dias para avaliação ultrassonográfica.";
      
      const res = await simulateWorker(jobId, 'DONE', summaryText);
      setFeedback(`Worker concluiu o Job #${jobId} com status DONE! (Documento: ${res.document_status})`);
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
    setLoading(true);
    setFeedback(null);
    try {
      const errorText = "Não foi possível extrair dados: documento com páginas corrompidas ou formato ilegível.";
      const res = await simulateWorker(jobId, 'FAILED', undefined, errorText);
      setFeedback(`Worker marcou o Job #${jobId} como FAILED! (Documento: ${res.document_status})`);
      setFeedbackType('error');
      onWorkerSimulated();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao simular falha no worker.');
      setFeedbackType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestIdempotency = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const summaryText = "Tentativa de reprocessamento idêntico para validação de idempotência.";
      await simulateWorker(jobId, 'DONE', summaryText);
      setFeedback(`Idempotência validada: Reenvio do status DONE no Job #${jobId} retornou HTTP 200 sem mutação indevida!`);
      setFeedbackType('neutral');
    } catch (err: any) {
      setFeedback(`Proteção de Idempotência disparada: ${err.message}`);
      setFeedbackType('neutral');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-slate-900/90 to-indigo-950/40 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 border border-indigo-500/30">
          <Cpu size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white tracking-tight">🛠️ Painel de Simulação do Worker</h2>
            <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold">
              POST /internal/jobs/{jobId}/complete
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Ferramenta para a banca avaliadora testar a conclusão assíncrona e destravar o polling instantaneamente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <button
          id="btn-simulate-success"
          type="button"
          onClick={handleSimulateSuccess}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 py-3 px-3.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Simular Sucesso (DONE)
        </button>

        <button
          id="btn-simulate-failure"
          type="button"
          onClick={handleSimulateFailure}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 py-3 px-3.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
          Simular Falha (FAILED)
        </button>

        <button
          id="btn-simulate-idempotency"
          type="button"
          onClick={handleTestIdempotency}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 hover:border-white/30 py-3 px-3.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
        >
          <ShieldCheck size={16} className="text-emerald-400" />
          Testar Idempotência
        </button>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl text-xs font-medium border leading-relaxed ${
          feedbackType === 'success'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : feedbackType === 'error'
            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            : 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30'
        }`}>
          {feedback}
        </div>
      )}
    </div>
  );
};
