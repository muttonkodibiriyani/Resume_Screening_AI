import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { jsonParse } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { callerIp } from '@/lib/auth';
import { apiHandler, parseQuery } from '@/lib/api';
import { requirePermission } from '@/lib/rbac';
import { reportQuerySchema } from '@/lib/validation/schemas';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const GET = apiHandler(async (req: NextRequest, { params }: { params: Record<string, string> }) => {
  const user = await requirePermission('report:download');
  const { format } = parseQuery(req, reportQuerySchema);

  const benchmarkId = params.benchmarkId;
  if (!benchmarkId) return NextResponse.json({ error: 'Benchmark id required' }, { status: 400 });

  const benchmark = await prisma.benchmark.findUnique({ where: { id: benchmarkId } });
  if (!benchmark) return NextResponse.json({ error: 'Benchmark not found', code: 'NOT_FOUND' }, { status: 404 });

  const candidates = await prisma.candidate.findMany({
    where: { benchmarkId },
    include: { score: true, decision: true },
  });

  const rows = candidates
    .filter((c) => c.score)
    .sort((a, b) => (b.score?.overallScore || 0) - (a.score?.overallScore || 0))
    .map((c, i) => ({
      rank: i + 1,
      candidate: c.candidateName || c.fileName,
      email: c.email || '',
      score: c.score?.overallScore || 0,
      band: c.score?.scoreBand || '',
      recommendation: c.score?.recommendation || '',
      risk: c.score?.risk || '',
      engine: c.score?.aiEngine || '',
      extractionStatus: c.extractionStatus,
      chars: c.extractedChars,
      matched: jsonParse<string[]>(c.score?.matchedSkills, []).length,
      missing: jsonParse<string[]>(c.score?.missingSkills, []).length,
      redFlags: jsonParse<string[]>(c.score?.redFlagsDetected, []).length,
      decision: c.decision?.decision || 'pending',
      decisionComments: c.decision?.comments || '',
    }));

  await logAudit({
    userId: user.id,
    action: 'REPORT_DOWNLOADED',
    entityType: 'Benchmark',
    entityId: benchmarkId,
    details: { format, candidates: rows.length },
    ipAddress: callerIp(),
  });

  const slug = benchmark.roleTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 60);

  if (format === 'csv') {
    const csv = Papa.unparse(rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="alshaya-ranking-${slug}.csv"`,
      },
    });
  }

  if (format === 'excel' || format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Alshaya AI Recruit';
    const ws = wb.addWorksheet('Ranking');
    ws.columns = [
      { header: 'Rank', key: 'rank', width: 6 },
      { header: 'Candidate', key: 'candidate', width: 32 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Score', key: 'score', width: 8 },
      { header: 'Band', key: 'band', width: 14 },
      { header: 'Recommendation', key: 'recommendation', width: 28 },
      { header: 'Risk', key: 'risk', width: 10 },
      { header: 'AI Engine', key: 'engine', width: 22 },
      { header: 'Extraction', key: 'extractionStatus', width: 14 },
      { header: 'Chars', key: 'chars', width: 8 },
      { header: 'Matched Skills', key: 'matched', width: 12 },
      { header: 'Missing Skills', key: 'missing', width: 12 },
      { header: 'Red Flags', key: 'redFlags', width: 10 },
      { header: 'Decision', key: 'decision', width: 12 },
      { header: 'Decision Comments', key: 'decisionComments', width: 32 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B1F2E' } };
    rows.forEach((r) => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="alshaya-ranking-${slug}.xlsx"`,
      },
    });
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFillColor(107, 31, 46);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(255);
    doc.setFontSize(16);
    doc.text('Alshaya AI Recruit - Candidate Ranking Report', 14, 14);
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Role: ${benchmark.roleTitle}`, 14, 30);
    doc.text(
      `Skill Family: ${benchmark.skillFamily} | Seniority: ${benchmark.seniority} | Min Exp: ${benchmark.minExperience}+ years`,
      14,
      36,
    );
    doc.text(
      `Benchmark v${benchmark.version} | Source: ${benchmark.benchmarkSource} | Engine: ${benchmark.generationMode} | Generated: ${new Date().toLocaleString()}`,
      14,
      42,
    );
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('AI scoring is advisory only. Final hiring decision rests with the recruiter and hiring manager.', 14, 48);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 54,
      head: [['#', 'Candidate', 'Score', 'Band', 'Engine', 'Match', 'Miss', 'Flags', 'Risk', 'Decision']],
      body: rows.map((r) => [
        r.rank,
        r.candidate,
        r.score,
        r.band,
        r.engine,
        r.matched,
        r.missing,
        r.redFlags,
        r.risk,
        r.decision,
      ]),
      headStyles: { fillColor: [107, 31, 46] },
      styles: { fontSize: 8 },
    });

    const top3 = rows.slice(0, 3);
    if (top3.length > 0) {
      doc.addPage();
      doc.setFillColor(107, 31, 46);
      doc.rect(0, 0, 297, 22, 'F');
      doc.setTextColor(255);
      doc.setFontSize(16);
      doc.text('Top 3 Recommended Candidates', 14, 14);
      doc.setTextColor(0);
      let y = 32;
      for (const r of top3) {
        const cand = candidates.find((c) => (c.candidateName || c.fileName) === r.candidate);
        if (!cand?.score) continue;
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`#${r.rank} ${r.candidate}  -  ${r.score}/100 (${r.band})`, 14, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const strengths = jsonParse<string[]>(cand.score.strengths, []).slice(0, 3);
        const gaps = jsonParse<string[]>(cand.score.gaps, []).slice(0, 3);
        const flags = jsonParse<string[]>(cand.score.redFlagsDetected, []).slice(0, 2);
        doc.text('Strengths:', 14, y);
        y += 4;
        strengths.forEach((s) => {
          doc.text(`- ${s.slice(0, 130)}`, 18, y);
          y += 4;
        });
        doc.text('Gaps:', 14, y);
        y += 4;
        gaps.forEach((s) => {
          doc.text(`- ${s.slice(0, 130)}`, 18, y);
          y += 4;
        });
        if (flags.length) {
          doc.text('Red Flags:', 14, y);
          y += 4;
          flags.forEach((s) => {
            doc.text(`- ${s.slice(0, 130)}`, 18, y);
            y += 4;
          });
        }
        y += 4;
        if (y > 190) {
          doc.addPage();
          y = 20;
        }
      }
    }

    const pdfBuf = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="alshaya-ranking-${slug}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
});
