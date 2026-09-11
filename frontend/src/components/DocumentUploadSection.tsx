import React, { useState, useRef } from 'react';
import { uploadDocument } from '../services/api';
import type { DocumentUploadResult } from '../types';
import { UploadCloud, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface DocumentUploadSectionProps {
  selectedPetId: number | null;
  selectedPetName?: string;
  onUploadSuccess: (res: DocumentUploadResult, file: File) => void;
}

export const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({
  selectedPetId,
  selectedPetName,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    const validExtensions = ['.txt', '.pdf'];
    const hasValidExt = validExtensions.some((ext) => selectedFile.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setError('Formato não aceito. Envie um prontuário em formato .pdf ou .txt.');
      return;
    }

    const MAX_BYTES = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > MAX_BYTES) {
      setError('Arquivo excede o limite máximo permitido de 10 MB.');
      return;
    }

    if (selectedFile.size === 0) {
      setError('O arquivo selecionado está vazio. Escolha um documento com conteúdo válido.');
      return;
    }

    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedPetId) {
      setError('Selecione ou cadastre um paciente antes de enviar o prontuário.');
      return;
    }
    if (!file) {
      setError('Selecione um arquivo .pdf ou .txt para iniciar a análise.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const result = await uploadDocument(selectedPetId, file);
      onUploadSuccess(result, file);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Falha na transmissão do prontuário para processamento.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
          <UploadCloud size={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Upload de Prontuário ou Exame</h2>
          <p className="text-xs text-slate-500">
            {selectedPetName 
              ? `Vinculando documento ao paciente: ${selectedPetName}`
              : 'Selecione um paciente acima para liberar o envio'}
          </p>
        </div>
      </div>

      <div
        id="dropzone-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 mb-4 ${
          isDragging 
            ? 'border-emerald-500 bg-emerald-50/60' 
            : 'border-slate-200 bg-slate-50/60 hover:border-emerald-500/60 hover:bg-emerald-50/20'
        }`}
      >
        <input
          id="file-upload-input"
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-emerald-600 border border-slate-200 shadow-xs">
            <FileText size={18} />
          </div>

          {file ? (
            <div>
              <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                {file.name}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {(file.size / 1024).toFixed(1)} KB — Pronto para transmissão
              </div>
            </div>
          ) : (
            <div>
              <div className="font-medium text-slate-800 text-xs sm:text-sm">
                Arraste o arquivo clínico aqui ou clique para selecionar
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Formatos aceitos: <span className="font-medium text-slate-700">.pdf</span> e <span className="font-medium text-slate-700">.txt</span> (máx. 10 MB)
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-rose-700 text-xs font-medium mb-3.5">
          <AlertCircle size={15} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <button
        id="btn-upload-document"
        type="button"
        onClick={handleUpload}
        disabled={!selectedPetId || !file || uploading}
        className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium py-2 px-4 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs shadow-sm"
      >
        {uploading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Enviando prontuário e registrando análise...
          </>
        ) : (
          <>
            <UploadCloud size={15} />
            Iniciar Análise do Prontuário
          </>
        )}
      </button>
    </div>
  );
};
