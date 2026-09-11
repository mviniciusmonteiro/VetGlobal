import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  listPets, 
  pollDocument, 
  getDocument, 
  checkHealth 
} from './services/api';
import type {
  Pet,
  DocumentUploadResult,
  DocumentDetails
} from './services/api';
import { PetSection } from './components/PetSection';
import { DocumentUploadSection } from './components/DocumentUploadSection';
import { PollingTimeline } from './components/PollingTimeline';
import { WorkerSimulatorPanel } from './components/WorkerSimulatorPanel';
import { SummaryCard } from './components/SummaryCard';
import { Stethoscope, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

const MAX_POLL_CYCLES = 4; // ~100s de limite máximo contínuo antes de pausar

export function App() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Active document & polling state
  const [activeUpload, setActiveUpload] = useState<DocumentUploadResult | null>(null);
  const [docDetails, setDocDetails] = useState<DocumentDetails | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [pollSeconds, setPollSeconds] = useState(0);
  const [pollCycleCount, setPollCycleCount] = useState(1);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Check health & load initial pets
  useEffect(() => {
    checkHealth()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));

    listPets()
      .then((data) => {
        setPets(data);
        if (data.length > 0) setSelectedPetId(data[0].id);
      })
      .catch(() => {});
  }, []);

  // Timer runner for visual feedback during polling
  const startTimer = () => {
    setPollSeconds(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setPollSeconds((prev) => +(prev + 0.1).toFixed(1));
    }, 100);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // The Long Polling Loop
  const executePollCycle = useCallback(async (docId: number, jobId: number, cycle: number) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsPolling(true);
    setPollTimedOut(false);
    startTimer();

    try {
      // Long-polls for up to 25 seconds against /documents/{id}/poll?after_job_id={jobId}
      const result = await pollDocument(docId, jobId, controller.signal);

      if (result) {
        // 200 OK: Completed by worker (DONE or FAILED)
        stopTimer();
        setIsPolling(false);
        setPollTimedOut(false);
        setDocDetails(result);
      } else {
        // 204 No Content: 25s timeout reached with no change in state.
        if (cycle >= MAX_POLL_CYCLES) {
          // Circuit breaker: interrompe loop automático para economizar recursos
          stopTimer();
          setIsPolling(false);
          setPollTimedOut(true);
          return;
        }

        // Aguarda 500ms de intervalo (backoff suave) antes do próximo ciclo
        setPollCycleCount(cycle + 1);
        setTimeout(() => {
          executePollCycle(docId, jobId, cycle + 1);
        }, 500);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      stopTimer();
      setIsPolling(false);
    }
  }, []);

  // Handler when document upload completes (HTTP 202)
  const handleUploadSuccess = (uploadRes: DocumentUploadResult) => {
    setActiveUpload(uploadRes);
    setDocDetails(null);
    setPollTimedOut(false);
    setPollCycleCount(1);
    executePollCycle(uploadRes.document_id, uploadRes.job_id, 1);
  };

  // Handler when worker finishes via simulator
  const handleWorkerSimulated = async () => {
    if (activeUpload) {
      // Fallback fast refresh in case the simulator completes and we want instant DOM update
      try {
        const fresh = await getDocument(activeUpload.document_id);
        if (fresh.status !== 'PENDING') {
          stopTimer();
          setIsPolling(false);
          setPollTimedOut(false);
          setDocDetails(fresh);
        }
      } catch {}
    }
  };

  const handleRefreshNow = async () => {
    if (activeUpload) {
      try {
        const fresh = await getDocument(activeUpload.document_id);
        setDocDetails(fresh);
        if (fresh.status !== 'PENDING') {
          stopTimer();
          setIsPolling(false);
          setPollTimedOut(false);
        }
      } catch {}
    }
  };

  const handleReset = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    stopTimer();
    setActiveUpload(null);
    setDocDetails(null);
    setIsPolling(false);
    setPollTimedOut(false);
    setPollSeconds(0);
    setPollCycleCount(1);
  };

  const selectedPet = pets.find((p) => p.id === selectedPetId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-20">
      {/* Top Navbar */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
            <Stethoscope size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              VetGlobal <span className="text-emerald-400">Processing Hub</span>
            </h1>
            <p className="text-xs text-slate-400">
              Processamento Assíncrono e Sumarização Clínica Veterinária
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            backendStatus === 'online' 
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}>
            {backendStatus === 'online' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {backendStatus === 'online' ? 'FastAPI Online (Port 8000)' : 'FastAPI Desconectado'}
          </div>

          <a
            id="link-swagger-docs"
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 hover:border-white/30 rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
          >
            Swagger UI <ExternalLink size={13} />
          </a>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Input & Upload */}
        <div className="flex flex-col gap-6">
          <PetSection
            pets={pets}
            selectedPetId={selectedPetId}
            onSelectPet={(id) => setSelectedPetId(id)}
            onPetCreated={(newPet) => setPets((prev) => [newPet, ...prev])}
          />

          <DocumentUploadSection
            selectedPetId={selectedPetId}
            selectedPetName={selectedPet?.name}
            onUploadSuccess={handleUploadSuccess}
          />
        </div>

        {/* Right Column: Polling, Simulation & Results */}
        <div className="flex flex-col gap-6">
          {activeUpload ? (
            <>
              <PollingTimeline
                documentId={activeUpload.document_id}
                jobId={activeUpload.job_id}
                isPolling={isPolling}
                pollSeconds={pollSeconds}
                docDetails={docDetails}
                pollCycleCount={pollCycleCount}
                isTimedOut={pollTimedOut}
                maxCycles={MAX_POLL_CYCLES}
                onRetryPoll={() => {
                  setPollTimedOut(false);
                  setPollCycleCount(1);
                  executePollCycle(activeUpload.document_id, activeUpload.job_id, 1);
                }}
                onRefreshNow={handleRefreshNow}
              />

              <WorkerSimulatorPanel
                jobId={activeUpload.job_id}
                onWorkerSimulated={handleWorkerSimulated}
              />

              {docDetails && (docDetails.status === 'READY' || docDetails.status === 'FAILED') && (
                <SummaryCard
                  document={docDetails}
                  onReset={handleReset}
                />
              )}
            </>
          ) : (
            <div className="bg-slate-900/75 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-12 text-center flex flex-col items-center justify-center min-h-[380px]">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-500 mb-4 border border-white/10">
                <Stethoscope size={32} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Pronto para Processamento
              </h3>
              <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                Selecione um paciente e envie um arquivo de prontuário (.txt ou .pdf) para iniciar o fluxo assíncrono e acompanhar o Long Polling.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-slate-500 border-t border-white/10 pt-6 leading-relaxed">
        VetGlobal Backend Project — FastAPI & SQLAlchemy 2.0 (PostgreSQL) + React 18 & Tailwind CSS v4 (Vite)
        <br />
        <span className="text-slate-400">
          Design 100% Stateless • Concorrência Segura (Starlette Event Loop) • BYTEA Storage &bull; Idempotência
        </span>
      </footer>
    </div>
  );
}

export default App;
