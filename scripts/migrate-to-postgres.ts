/**
 * One-shot migration: drain the SQLite dev DB into a Postgres prod DB.
 *
 * Usage:
 *   1. Set `DATABASE_URL` env var to your Postgres connection string.
 *   2. Run: npx tsx scripts/migrate-to-postgres.ts
 *
 * Idempotent: skips rows already present (matched by id).
 */
/* eslint-disable no-console */
import { PrismaClient as SqliteClient } from '@prisma/client';

async function main() {
  console.log('SQLite -> Postgres migration starting...');

  const sqliteUrl = 'file:./prisma/dev.db';
  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl || !pgUrl.startsWith('postgres')) {
    throw new Error('Set DATABASE_URL to a Postgres connection string before running this script.');
  }

  const sqlite = new SqliteClient({ datasources: { db: { url: sqliteUrl } } });

  // Load the Postgres client (separate output dir, see prisma/schema.postgres.prisma)
  let pgClient: SqliteClient;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pgMod = require('@prisma/client-postgres');
    pgClient = new pgMod.PrismaClient({ datasources: { db: { url: pgUrl } } });
  } catch {
    console.warn('Postgres client not generated yet. Run: npx prisma generate --schema=prisma/schema.postgres.prisma');
    process.exit(1);
  }

  // Order matters because of foreign keys.
  const users = await sqlite.user.findMany();
  console.log(`Users: ${users.length}`);
  for (const u of users) {
    await pgClient.user.upsert({ where: { id: u.id }, update: u, create: u });
  }

  const benchmarks = await sqlite.benchmark.findMany();
  console.log(`Benchmarks: ${benchmarks.length}`);
  for (const b of benchmarks) {
    await pgClient.benchmark.upsert({
      where: { id: b.id },
      update: jsonifyBenchmark(b),
      create: jsonifyBenchmark(b),
    });
  }

  const candidates = await sqlite.candidate.findMany();
  console.log(`Candidates: ${candidates.length}`);
  for (const c of candidates) {
    await pgClient.candidate.upsert({ where: { id: c.id }, update: c, create: c });
  }

  const scores = await sqlite.scoreResult.findMany();
  console.log(`Scores: ${scores.length}`);
  for (const s of scores) {
    await pgClient.scoreResult.upsert({
      where: { id: s.id },
      update: jsonifyScore(s),
      create: jsonifyScore(s),
    });
  }

  const decisions = await sqlite.decision.findMany();
  console.log(`Decisions: ${decisions.length}`);
  for (const d of decisions) {
    await pgClient.decision.upsert({ where: { id: d.id }, update: d, create: d });
  }

  const audits = await sqlite.auditLog.findMany();
  console.log(`Audits: ${audits.length}`);
  for (const a of audits) {
    await pgClient.auditLog.upsert({
      where: { id: a.id },
      update: { ...a, details: a.details ? JSON.parse(a.details) : null },
      create: { ...a, details: a.details ? JSON.parse(a.details) : null },
    });
  }

  await sqlite.$disconnect();
  await pgClient.$disconnect();
  console.log('Migration complete.');
}

function parseOrNull(s: string | null | undefined): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

type AnyRecord = Record<string, unknown>;

function jsonifyBenchmark(b: AnyRecord): AnyRecord {
  const stringKeys = ['primarySkills', 'mandatorySkills', 'goodToHaveSkills', 'technicalDepth', 'functionalDomain', 'architectureExp', 'leadershipExp', 'deliveryExp', 'modernizationExp', 'redFlags', 'weights', 'interviewQuestions', 'screeningNotes', 'sources'];
  const out: AnyRecord = { ...b };
  for (const k of stringKeys) out[k] = parseOrNull(b[k] as string);
  return out;
}

function jsonifyScore(s: AnyRecord): AnyRecord {
  const stringKeys = ['breakdown', 'matchedSkills', 'missingSkills', 'partiallyEvidenced', 'matchedEvidence', 'missingEvidence', 'redFlagsDetected', 'strengths', 'gaps', 'interviewFocusAreas', 'interviewQuestions', 'weightsSnapshot'];
  const out: AnyRecord = { ...s };
  for (const k of stringKeys) out[k] = parseOrNull(s[k] as string);
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
