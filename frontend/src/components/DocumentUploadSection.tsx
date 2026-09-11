import React, { useState, useRef } from 'react';
import { uploadDocument } from '../services/api';
import type { DocumentUploadResult } from '../services/api';
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
      setError('Formato inválido. Apenas arquivos .txt e .pdf são aceitos (HTTP 415).');
      return;
    }

    const MAX_BYTES = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > MAX_BYTES) {
      setError('Arquivo muito grande. O limite máximo permitido é 10 MB (HTTP 413).');
      return;
    }

    if (selectedFile.size === 0) {
      setError('O arquivo enviado está vazio (HTTP 422).');
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
      setError('Por favor, selecione um paciente no passo 1.');
      return;
    }
    if (!file) {
      setError('Selecione um arquivo para upload.');
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
      setError(err.message || 'Erro ao realizar upload do documento.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-900/75 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-6 transition-all duration-200 hover:border-white/20">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
          <UploadCloud size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">2. Upload do Prontuário Clínico</h2>
          <p className="text-xs text-slate-400">
            {selectedPetName 
              ? `Associando documento a ${selectedPetName} (ID #${selectedPetId})`
              : 'Selecione um pet acima para habilitar o envio'}
          </p>
        </div>
      </div>

      <div
        id="dropzone-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 mb-4 ${
          isDragging 
            ? 'border-emerald-500 bg-emerald-500/10' 
            : 'border-white/15 bg-slate-950/40 hover:border-white/30 hover:bg-slate-950/60'
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

        <div className="flex flex-col items-center gap-2.5">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-emerald-400 border border-white/10 shadow-inner">
            <FileText size={24} />
          </div>

          {file ? (
            <div>
              <div className="font-semibold text-white text-base">
                📄 {file.name}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {(file.size / 1024).toFixed(1)} KB — Pronto para enviar
              </div>
            </div>
          ) : (
            <div>
              <div className="font-medium text-white text-sm">
                Arraste seu arquivo clínico aqui ou clique para selecionar
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Suporta apenas <strong className="text-slate-300">.txt</strong> e <strong className="text-slate-300">.pdf</strong> (máx. 10 MB)
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-rose-400 text-xs font-medium mb-4">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        id="btn-upload-document"
        type="button"
        onClick={handleUpload}
        disabled={!selectedPetId || !file || uploading}
        className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {uploading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Enviando e enfileirando Job (POST /pets/{selectedPetId}/documents)...
          </>
        ) : (
          <>
            <UploadCloud size={18} />
            Iniciar Processamento Clínico (HTTP 202)
          </>
        )}
      </button>
    </div>
  );
};
