import { useState, useRef, useCallback, useEffect } from 'react';
import { pollDocument, getDocument } from '../services/api';
import type { DocumentUploadResult, DocumentDetails } from '../types';

const MAX_POLL_CYCLES = 4; // ~100s de limite máximo contínuo antes de pausar

export function useDocumentPolling() {
  const [activeUpload, setActiveUpload] = useState<DocumentUploadResult | null>(null);
  const [docDetails, setDocDetails] = useState<DocumentDetails | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [pollSeconds, setPollSeconds] = useState(0);
  const [pollCycleCount, setPollCycleCount] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<{
    timestamp: string;
    status: string;
    message: string;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Timer runner for visual feedback during polling
  const startTimer = useCallback(() => {
    setPollSeconds(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setPollSeconds((prev) => +(prev + 0.1).toFixed(1));
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Long Polling Loop
  const executePollCycle = useCallback(
    async (docId: number, jobId: number, cycle: number) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsPolling(true);
      setPollTimedOut(false);
      startTimer();

      try {
        const result = await pollDocument(docId, jobId, controller.signal);

        if (result) {
          stopTimer();
          setIsPolling(false);
          setPollTimedOut(false);
          setDocDetails(result);
        } else {
          if (cycle >= MAX_POLL_CYCLES) {
            stopTimer();
            setIsPolling(false);
            setPollTimedOut(true);
            return;
          }

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
    },
    [startTimer, stopTimer]
  );

  // Start polling when a document upload succeeds
  const startPolling = useCallback(
    (uploadRes: DocumentUploadResult) => {
      setActiveUpload(uploadRes);
      setDocDetails(null);
      setPollTimedOut(false);
      setPollCycleCount(1);
      setLastCheckResult(null);
      executePollCycle(uploadRes.document_id, uploadRes.job_id, 1);
    },
    [executePollCycle]
  );

  // Retry polling if timed out
  const retryPolling = useCallback(() => {
    if (activeUpload) {
      setPollTimedOut(false);
      setPollCycleCount(1);
      setLastCheckResult(null);
      executePollCycle(activeUpload.document_id, activeUpload.job_id, 1);
    }
  }, [activeUpload, executePollCycle]);

  // Handle immediate update when worker is simulated
  const handleWorkerSimulated = useCallback(async () => {
    if (activeUpload) {
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
  }, [activeUpload, stopTimer]);

  // Refresh status manually (Checar Agora)
  const refreshNow = useCallback(async () => {
    if (!activeUpload) return;
    setIsRefreshing(true);
    try {
      const fresh = await getDocument(activeUpload.document_id);
      setDocDetails(fresh);
      const timeStr = new Date().toLocaleTimeString('pt-BR');

      if (fresh.status !== 'PENDING') {
        stopTimer();
        setIsPolling(false);
        setPollTimedOut(false);
        setLastCheckResult({
          timestamp: timeStr,
          status: fresh.status,
          message: `Processamento finalizado: ${fresh.status} às ${timeStr}`,
        });
      } else {
        setLastCheckResult({
          timestamp: timeStr,
          status: 'PENDING',
          message: `Confirmado às ${timeStr}: Prontuário #${activeUpload.document_id} ainda está em processamento na fila.`,
        });
      }
    } catch (err: any) {
      const timeStr = new Date().toLocaleTimeString('pt-BR');
      setLastCheckResult({
        timestamp: timeStr,
        status: 'ERROR',
        message: `Falha na consulta (${timeStr}): ${err.message || 'Sem resposta da API'}`,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [activeUpload, stopTimer]);

  // Reset all polling state
  const reset = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    stopTimer();
    setActiveUpload(null);
    setDocDetails(null);
    setIsPolling(false);
    setPollTimedOut(false);
    setPollSeconds(0);
    setPollCycleCount(1);
    setIsRefreshing(false);
    setLastCheckResult(null);
  }, [stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  return {
    activeUpload,
    docDetails,
    isPolling,
    pollTimedOut,
    pollSeconds,
    pollCycleCount,
    isRefreshing,
    lastCheckResult,
    maxCycles: MAX_POLL_CYCLES,
    startPolling,
    retryPolling,
    refreshNow,
    handleWorkerSimulated,
    reset,
  };
}
