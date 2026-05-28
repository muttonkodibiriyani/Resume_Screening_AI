/**
 * Storage abstraction.
 *
 *   STORAGE_PROVIDER=local      -> ./uploads on disk
 *   STORAGE_PROVIDER=azure-blob -> Azure Blob Storage (Managed Identity or connection string)
 *
 * Swap by env-var only - no code changes when moving from local -> Azure.
 */
import { env } from '../env';
import { LocalFsStorage } from './local-fs';
import { AzureBlobStorage } from './azure-blob';

export interface ResumeFileMeta {
  /** Provider-specific path/key, e.g. "2026/05/29/abc123-resume.pdf". */
  path: string;
  /** Bytes. */
  size: number;
  /** Detected MIME (after server-side sniffing). */
  contentType: string;
  /** First 16 chars of sha256 of the file contents, used for de-dup. */
  sha: string;
}

export interface StorageDriver {
  /** Persist a resume file; returns the storage path/key for retrieval. */
  save(opts: { buffer: Buffer; fileName: string; contentType: string; sha: string }): Promise<ResumeFileMeta>;
  /** Load a stored file. Returns null if missing. */
  load(path: string): Promise<{ buffer: Buffer; contentType: string } | null>;
  /** Delete a stored file (best effort). */
  delete(path: string): Promise<void>;
}

let cached: StorageDriver | null = null;
function driver(): StorageDriver {
  if (cached) return cached;
  const provider = env().STORAGE_PROVIDER;
  cached = provider === 'azure-blob' ? new AzureBlobStorage() : new LocalFsStorage();
  return cached;
}

export const saveResume: StorageDriver['save'] = (opts) => driver().save(opts);
export const loadResume: StorageDriver['load'] = (path) => driver().load(path);
export const deleteResume: StorageDriver['delete'] = (path) => driver().delete(path);

/** Test helper. */
export function _setStorageDriver(d: StorageDriver | null): void {
  cached = d;
}
