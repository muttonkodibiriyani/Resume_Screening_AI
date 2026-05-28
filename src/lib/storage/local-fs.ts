import { promises as fs } from 'node:fs';
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
  return path.posix.join(String(yyyy), mm, dd);
}

export class LocalFsStorage implements StorageDriver {
  private root(): string {
    return path.resolve(process.cwd(), env().LOCAL_STORAGE_PATH);
  }

  async save(opts: { buffer: Buffer; fileName: string; contentType: string; sha: string }): Promise<ResumeFileMeta> {
    const shard = dateShard();
    const fileName = `${opts.sha}-${safeName(opts.fileName)}`;
    const rel = path.posix.join(shard, fileName);
    const abs = path.resolve(this.root(), shard, fileName);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, opts.buffer);
    return { path: rel, size: opts.buffer.length, contentType: opts.contentType, sha: opts.sha };
  }

  async load(rel: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const abs = path.resolve(this.root(), rel);
      // Defence-in-depth: ensure the resolved path is still under root (no `..` traversal).
      if (!abs.startsWith(this.root())) return null;
      const buffer = await fs.readFile(abs);
      const ext = path.extname(rel).toLowerCase();
      const contentType =
        ext === '.pdf'
          ? 'application/pdf'
          : ext === '.docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : ext === '.txt'
              ? 'text/plain'
              : 'application/octet-stream';
      return { buffer, contentType };
    } catch {
      return null;
    }
  }

  async delete(rel: string): Promise<void> {
    try {
      const abs = path.resolve(this.root(), rel);
      if (!abs.startsWith(this.root())) return;
      await fs.unlink(abs);
    } catch {
      // best effort
    }
  }
}
