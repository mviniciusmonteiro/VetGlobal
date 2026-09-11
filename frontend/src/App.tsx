import { usePatients } from './hooks/usePatients';
import { useDocumentPolling } from './hooks/useDocumentPolling';
import { Header } from './components/Header';
import { WorkflowStepper } from './components/WorkflowStepper';
import { PetSection } from './components/PetSection';
import { DocumentUploadSection } from './components/DocumentUploadSection';
import { PollingTimeline } from './components/PollingTimeline';
import { WorkerSimulatorPanel } from './components/WorkerSimulatorPanel';
import { SummaryCard } from './components/SummaryCard';
import { PawPrint } from 'lucide-react';

export function App() {
  const { 
    pets, 
    selectedPet, 
    selectedPetId, 
    backendStatus, 
    selectPet, 
    addPet 
  } = usePatients();

  const {
    activeUpload,
    docDetails,
    isPolling,
    pollTimedOut,
    pollSeconds,
    pollCycleCount,
    maxCycles,
    isRefreshing,
    lastCheckResult,
    startPolling,
    retryPolling,
    refreshNow,
    handleWorkerSimulated,
    reset,
  } = useDocumentPolling();

  const isPetSelected = !!selectedPetId;
  const isDocUploaded = !!activeUpload;
  const isProcessing = isPolling || (activeUpload && docDetails?.status === 'PENDING');
  const isDone = docDetails?.status === 'READY';

  return (
    <div className="w-full min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* 1. Header do Sistema */}
      <Header backendStatus={backendStatus} />

      {/* 2. Régua de Etapas Centralizada */}
      <WorkflowStepper
        isPetSelected={isPetSelected}
        selectedPetName={selectedPet?.name}
        isDocUploaded={isDocUploaded}
        documentId={activeUpload?.document_id}
        isProcessing={!!isProcessing}
        isDone={isDone}
      />

      {/* 3. Área de Trabalho Principal Full-Width */}
      <main className="w-full flex-1 p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Painel Esquerdo: Diretório de Pacientes e Upload (4 Colunas) */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-4">
          <PetSection
            pets={pets}
            selectedPetId={selectedPetId}
            onSelectPet={selectPet}
            onPetCreated={addPet}
          />

          <DocumentUploadSection
            selectedPetId={selectedPetId}
            selectedPetName={selectedPet?.name}
            onUploadSuccess={startPolling}
          />
        </div>

        {/* Painel Direito: Monitoramento, Laudo e Worker Simulator (8 Colunas) */}
        <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-4">
          {activeUpload ? (
            <>
              {/* Laudo Clínico Sumarizado */}
              {docDetails && (docDetails.status === 'READY' || docDetails.status === 'FAILED') && (
                <SummaryCard
                  document={docDetails}
                  onReset={reset}
                />
              )}

              {/* Monitor de Processamento Clínico (Long Polling) */}
              <PollingTimeline
                documentId={activeUpload.document_id}
                jobId={activeUpload.job_id}
                isPolling={isPolling}
                pollSeconds={pollSeconds}
                docDetails={docDetails}
                pollCycleCount={pollCycleCount}
                isTimedOut={pollTimedOut}
                maxCycles={maxCycles}
                isRefreshing={isRefreshing}
                lastCheckResult={lastCheckResult}
                onRetryPoll={retryPolling}
                onRefreshNow={refreshNow}
              />

              {/* Console de Simulação do Worker - ABAIXO DO MONITOR */}
              <WorkerSimulatorPanel
                jobId={activeUpload.job_id}
                onWorkerSimulated={handleWorkerSimulated}
              />
            </>
          ) : (
            <>
              {/* Estado Vazio Clínico */}
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center flex flex-col items-center justify-center shadow-xs">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-100">
                  <PawPrint size={24} />
                </div>
                <h2 className="text-sm font-semibold text-slate-900 mb-1">
                  Pronto para Recepção de Exames
                </h2>
                <p className="text-slate-500 text-xs max-w-sm leading-relaxed">
                  Selecione um paciente na coluna ao lado e envie o prontuário (.pdf ou .txt). O laudo sumarizado aparecerá aqui automaticamente.
                </p>
              </div>

              {/* Worker Simulator sempre visível abaixo do painel */}
              <WorkerSimulatorPanel
                jobId={null}
                onWorkerSimulated={handleWorkerSimulated}
              />
            </>
          )}
        </div>
      </main>

      {/* 4. Rodapé Discreto */}
      <footer className="w-full mt-auto border-t border-slate-200 bg-white py-2.5 px-6 text-xs text-slate-500 flex justify-between items-center">
        <span>VetGlobal · Plataforma Clínica Veterinária</span>
        <span className="text-[11px] text-slate-400 font-mono">Processamento Assíncrono</span>
      </footer>
    </div>
  );
}

export default App;
