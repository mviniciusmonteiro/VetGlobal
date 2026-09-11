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

export type BackendStatus = 'online' | 'offline' | 'checking';
