import React from 'react';

interface WorkflowStepperProps {
  isPetSelected: boolean;
  selectedPetName?: string;
  isDocUploaded: boolean;
  documentId?: number;
  isProcessing: boolean;
  isDone: boolean;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  isPetSelected,
  selectedPetName,
  isDocUploaded,
  documentId,
  isProcessing,
  isDone,
}) => {
  return (
    <div className="w-full bg-white border-b border-slate-200/90 py-2 px-4 shadow-2xs">
      <div className="w-full flex items-center justify-center gap-1.5 sm:gap-3 text-xs overflow-x-auto scrollbar-none">
        {/* Etapa 1: Paciente */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full transition-all shrink-0 ${
            isPetSelected
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs'
              : 'bg-slate-100 text-slate-500 border border-transparent'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isPetSelected ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
            }`}
          >
            {isPetSelected ? '✓' : '1'}
          </span>
          <span className="font-semibold text-xs">
            {selectedPetName ? `Paciente: ${selectedPetName}` : 'Identificar Paciente'}
          </span>
        </div>

        <div
          className={`w-4 sm:w-8 h-[2px] transition-colors shrink-0 ${
            isPetSelected ? 'bg-emerald-400' : 'bg-slate-200'
          }`}
        />

        {/* Etapa 2: Prontuário */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full transition-all shrink-0 ${
            isDocUploaded
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs'
              : isPetSelected
              ? 'bg-slate-50 text-slate-700 border border-slate-200'
              : 'bg-slate-100 text-slate-400 border border-transparent'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isDocUploaded
                ? 'bg-emerald-600 text-white'
                : isPetSelected
                ? 'bg-slate-400 text-white'
                : 'bg-slate-200 text-slate-400'
            }`}
          >
            {isDocUploaded ? '✓' : '2'}
          </span>
          <span className="font-semibold text-xs">
            {documentId ? `Prontuário #${documentId}` : 'Enviar Prontuário'}
          </span>
        </div>

        <div
          className={`w-4 sm:w-8 h-[2px] transition-colors shrink-0 ${
            isDocUploaded ? 'bg-emerald-400' : 'bg-slate-200'
          }`}
        />

        {/* Etapa 3: Processamento */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full transition-all shrink-0 ${
            isDone
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs'
              : isProcessing
              ? 'bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs ring-1 ring-amber-400/30'
              : 'bg-slate-100 text-slate-400 border border-transparent'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isDone
                ? 'bg-emerald-600 text-white'
                : isProcessing
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-slate-200 text-slate-400'
            }`}
          >
            {isDone ? '✓' : '3'}
          </span>
          <span className="font-semibold text-xs">
            {isDone ? 'Processado' : isProcessing ? 'Em Análise (Polling)' : 'Processamento'}
          </span>
        </div>

        <div
          className={`w-4 sm:w-8 h-[2px] transition-colors shrink-0 ${
            isDone ? 'bg-emerald-400' : 'bg-slate-200'
          }`}
        />

        {/* Etapa 4: Laudo Clínico */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full transition-all shrink-0 ${
            isDone
              ? 'bg-emerald-600 text-white font-semibold shadow-xs'
              : 'bg-slate-100 text-slate-400 border border-transparent'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isDone ? 'bg-white text-emerald-700' : 'bg-slate-200 text-slate-400'
            }`}
          >
            {isDone ? '✓' : '4'}
          </span>
          <span className="text-xs">Laudo Clínico</span>
        </div>
      </div>
    </div>
  );
};
