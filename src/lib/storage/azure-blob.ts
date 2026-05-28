/**
 * Azure Blob Storage driver.
 *
 * Activated when STORAGE_PROVIDER=azure-blob. Uses connection string by default;
 * production should use Managed Identity (DefaultAzureCredential) - documented
 * in docs/AZURE_DEPLOYMENT.md.
 *
 * @azure/storage-blob is imported lazily so the package is optional for
 * local dev (LocalFs driver doesn't need it).
 */
import path from 'node:path';
import { env } from '../env';
import type { StorageDriver, ResumeFileMeta } from './index';

function safeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

function dateShard(d = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

interface BlobClient {
  upload(buffer: Buffer, length: number, opts?: { blobHTTPHeaders?: { blobContentType: string } }): Promise<unknown>;
  downloadToBuffer(): Promise<Buffer>;
  deleteIfExists(): Promise<unknown>;
  getProperties(): Promise<{ contentType?: string }>;
}

interface ContainerClient {
  createIfNotExists(): Promise<unknown>;
  getBlockBlobClient(blobName: string): BlobClient;
}

interface BlobServiceClient {
  getContainerClient(container: string): ContainerClient;
}

export class AzureBlobStorage implements StorageDriver {
  private serviceClient: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;

  private async getContainer(): Promise<ContainerClient> {
    if (this.containerClient) return this.containerClient;
    const conn = env().AZURE_BLOB_CONNECTION_STRING;
    if (!conn) throw new Error('AZURE_BLOB_CONNECTION_STRING is required when STORAGE_PROVIDER=azure-blob');

    // Lazy import; @azure/storage-blob is optional for local dev.
    const mod = (await import('@azure/storage-blob' as string).catch(() => {
      throw new Error('Install @azure/storage-blob: npm install @azure/storage-blob');
    })) as { BlobServiceClient: { fromConnectionString(c: string): BlobServiceClient } };

    this.serviceClient = mod.BlobServiceClient.fromConnectionString(conn);
    const container = this.serviceClient.getContainerClient(env().AZURE_BLOB_CONTAINER);
    await container.createIfNotExists();
    this.containerClient = container;
    return container;
  }

  async save(opts: { buffer: Buffer; fileName: string; contentType: string; sha: string }): Promise<ResumeFileMeta> {
    const container = await this.getContainer();
    const blobName = `${dateShard()}/${opts.sha}-${safeName(opts.fileName)}`;
    const blob = container.getBlockBlobClient(blobName);
    await blob.upload(opts.buffer, opts.buffer.length, {
      blobHTTPHeaders: { blobContentType: opts.contentType },
    });
    return { path: blobName, size: opts.buffer.length, contentType: opts.contentType, sha: opts.sha };
  }

  async load(blobPath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const container = await this.getContainer();
      const blob = container.getBlockBlobClient(blobPath);
      const buffer = await blob.downloadToBuffer();
      const props = await blob.getProperties();
      const ext = path.extname(blobPath).toLowerCase();
      const contentType =
        props.contentType ||
        (ext === '.pdf'
          ? 'application/pdf'
          : ext === '.docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : ext === '.txt'
              ? 'text/plain'
              : 'application/octet-stream');
      return { buffer, contentType };
    } catch {
      return null;
    }
  }

  async delete(blobPath: string): Promise<void> {
    try {
      const container = await this.getContainer();
      const blob = container.getBlockBlobClient(blobPath);
      await blob.deleteIfExists();
    } catch {
      // best effort
    }
  }
}
