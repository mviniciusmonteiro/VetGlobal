// API Service for communicating with the VetGlobal FastAPI backend

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Pet {
  id: number;
  name: string;
  owner_name: string;
  created_at?: string;
}

export interface DocumentUploadResult {
  document_id: number;
  job_id: number;
  status: 'ENQUEUED';
}

export interface DocumentDetails {
  id: number;
  pet_id: number;
  filename: string;
  file_size: number;
  status: 'PENDING' | 'READY' | 'FAILED';
  summary: string | null;
  error: string | null;
  created_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface JobCompleteResult {
  job_id: number;
  status: 'DONE' | 'FAILED';
  document_id: number;
  document_status: 'READY' | 'FAILED';
  summary: string | null;
  error: string | null;
  completed_at: string | null;
}

/**
 * Fetch all registered pets
 */
export async function listPets(): Promise<Pet[]> {
  const res = await fetch(`${API_BASE}/pets`);
  if (!res.ok) throw new Error('Falha ao listar pets.');
  return res.json();
}

/**
 * Create a new pet
 */
export async function createPet(name: string, ownerName: string): Promise<Pet> {
  const res = await fetch(`${API_BASE}/pets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), owner_name: ownerName.trim() }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Falha ao cadastrar pet.');
  }
  return res.json();
}

/**
 * Upload a clinical document for a pet
 */
export async function uploadDocument(petId: number, file: File): Promise<DocumentUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/pets/${petId}/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Erro no upload (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Fetch document details by ID
 */
export async function getDocument(documentId: number): Promise<DocumentDetails> {
  const res = await fetch(`${API_BASE}/documents/${documentId}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Documento não encontrado (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Long-poll document processing state.
 * Returns DocumentDetails when completed (DONE/FAILED), or null if 204 No Content (timeout).
 */
export async function pollDocument(
  documentId: number,
  afterJobId: number = 0,
  signal?: AbortSignal
): Promise<DocumentDetails | null> {
  const res = await fetch(
    `${API_BASE}/documents/${documentId}/poll?after_job_id=${afterJobId}`,
    { signal }
  );

  if (res.status === 204) {
    return null; // Polling timeout
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Erro no polling (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Simulate a worker completing a job (internal testing/demo endpoint)
 */
export async function simulateWorker(
  jobId: number,
  status: 'DONE' | 'FAILED',
  summary?: string,
  error?: string
): Promise<JobCompleteResult> {
  const res = await fetch(`${API_BASE}/internal/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      summary: status === 'DONE' ? summary : undefined,
      error: status === 'FAILED' ? error : undefined,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Erro ao concluir job (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Check backend health
 */
export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
