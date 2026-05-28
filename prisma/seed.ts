import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BENCHMARK_TEMPLATES } from '../src/lib/benchmarks/templates';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');

  // Users
  const users = [
    { email: 'recruiter@alshaya.com', name: 'Sarah Recruiter', role: 'recruiter', password: 'password123' },
    { email: 'hiring@alshaya.com', name: 'Ahmed Hiring Manager', role: 'hiring_manager', password: 'password123' },
    { email: 'admin@alshaya.com', name: 'Layla Admin', role: 'admin', password: 'password123' },
    { email: 'panel@alshaya.com', name: 'Omar Interview Panel', role: 'interview_panel', password: 'password123' },
    { email: 'viewer@alshaya.com', name: 'Noor Viewer', role: 'viewer', password: 'password123' },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, role: u.role, password: hash },
    });
  }
  console.log(`✓ ${users.length} users seeded`);

  // Benchmark templates (only seed if empty)
  const existing = await prisma.benchmark.count();
  if (existing === 0) {
    for (const t of BENCHMARK_TEMPLATES) {
      await prisma.benchmark.create({
        data: {
          roleTitle: t.roleTitle,
          skillFamily: t.skillFamily,
          seniority: t.seniority,
          minExperience: t.minExperience,
          domainContext: t.domainContext,
          primarySkills: JSON.stringify(t.primarySkills),
          mandatorySkills: JSON.stringify(t.mandatorySkills),
          goodToHaveSkills: JSON.stringify(t.goodToHaveSkills),
          technicalDepth: JSON.stringify(t.technicalDepthIndicators),
          functionalDomain: JSON.stringify(t.functionalDomainIndicators),
          architectureExp: JSON.stringify(t.architectureExpectations),
          leadershipExp: JSON.stringify(t.leadershipExpectations),
          deliveryExp: JSON.stringify(t.deliveryExpectations),
          modernizationExp: JSON.stringify(t.modernizationExpectations),
          redFlags: JSON.stringify(t.redFlags),
          weights: JSON.stringify(t.weights),
          interviewQuestions: JSON.stringify(t.interviewQuestions),
          idealSummary: t.idealSummary,
          screeningNotes: JSON.stringify(t.screeningNotes),
          benchmarkSource: 'template',
          generationMode: 'local-rule',
          sources: JSON.stringify([]),
          approvalStatus: 'approved',
        },
      });
    }
    console.log(`✓ ${BENCHMARK_TEMPLATES.length} benchmarks seeded`);
  } else {
    console.log(`↩ Skipped benchmarks (${existing} already exist)`);
  }

  console.log('✅ Done.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
