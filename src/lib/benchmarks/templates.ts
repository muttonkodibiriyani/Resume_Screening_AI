/**
 * Pre-built benchmark library — 11 role templates with deep, role-specific criteria.
 * These are used as fallback when AI is not configured, and as seed data.
 */

export interface BenchmarkTemplate {
  roleTitle: string;
  skillFamily: string;
  seniority: string;
  minExperience: number;
  domainContext: string;
  primarySkills: string[];
  mandatorySkills: string[];
  goodToHaveSkills: string[];
  technicalDepthIndicators: string[];
  functionalDomainIndicators: string[];
  architectureExpectations: string[];
  leadershipExpectations: string[];
  deliveryExpectations: string[];
  modernizationExpectations: string[];
  redFlags: string[];
  weights: Record<string, number>;
  interviewQuestions: string[];
  idealSummary: string;
  screeningNotes: string[];
}

export const DEFAULT_WEIGHTS = {
  years: 10, primarySkillDepth: 25, architectureArtifacts: 20, projectFootprint: 15,
  leadership: 10, modernization: 10, certifications: 5, communication: 5,
};

export const BENCHMARK_TEMPLATES: BenchmarkTemplate[] = [
  {
    roleTitle: 'Sr. Technical Architect — ODI, Automic, OIC & OFMW, PL/SQL',
    skillFamily: 'Oracle Integration & Data',
    seniority: 'Senior',
    minExperience: 15,
    domainContext: 'Retail enterprise integration, EDI, hybrid cloud',
    primarySkills: ['Oracle Data Integrator (ODI 11g/12c)', 'Oracle Integration Cloud (OIC)', 'Oracle Fusion Middleware (SOA Suite, OSB)', 'Automic Automation', 'PL/SQL (advanced)', 'EDI (EDIFACT/X12/AS2)'],
    mandatorySkills: ['ODI Knowledge Modules customization', 'OIC adapters & integrations', 'PL/SQL packages, performance tuning', 'Automic enterprise scheduling', 'Integration governance'],
    goodToHaveSkills: ['B2B Trading Partner Onboarding', 'CI/CD for integrations', 'Hybrid integration patterns', 'API-led connectivity', 'Microservices'],
    technicalDepthIndicators: ['Designed hub-and-spoke / canonical patterns', 'PL/SQL tuning (execution plans, partitioning, bulk ops)', 'Custom KMs', 'Reusable integration libraries', 'Error handling frameworks'],
    functionalDomainIndicators: ['Retail integration (POS, Merchandising, Finance)', 'B2B partner onboarding', 'Multi-country deployment'],
    architectureExpectations: ['HLD/LLD ownership', 'Integration reference architecture', 'API governance', 'EDI gateway design', 'Hybrid cloud integration architecture'],
    leadershipExpectations: ['Led team of 8+ integration developers', 'Vendor management', 'Stakeholder workshops', 'Mentoring & code review standards'],
    deliveryExpectations: ['2+ full-lifecycle integration platforms', 'Production go-lives at enterprise scale', 'SLA-bound integration operations', 'Performance benchmarks'],
    modernizationExpectations: ['On-prem to OIC migration', 'CI/CD pipelines (Git, Jenkins/ADO)', 'Observability (App Insights, Splunk)', 'API-first redesign'],
    redFlags: ['"Architect" without HLD/LLD evidence', 'Only ODI mapping work without governance', 'No EDI/B2B exposure for retail', 'Skill stacking without project depth', 'No production go-live'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'Walk through an OIC + ODI integration you architected end-to-end.',
      'How do you tune a PL/SQL package that processes 10M rows nightly?',
      'Describe your EDI gateway design — trading partner onboarding, AS2/SFTP, retries.',
      'How do you design Automic workflows to meet a 4-hour SLA?',
      'Compare canonical vs point-to-point integration — when and why?',
    ],
    idealSummary: '15+ year senior integration architect with deep ODI/OIC/OFMW mastery, PL/SQL tuning, Automic orchestration, EDI gateway design, and proven enterprise go-lives.',
    screeningNotes: ['Verify EDI project names', 'Ask for HLD samples', 'Probe Automic SLA design'],
  },
  {
    roleTitle: 'Sr. Technical Architect — Azure Integration Services',
    skillFamily: 'Azure Integration',
    seniority: 'Senior',
    minExperience: 15,
    domainContext: 'Enterprise iPaaS on Microsoft Azure',
    primarySkills: ['Azure Logic Apps', 'Azure Functions', 'Service Bus', 'Event Grid', 'API Management', 'Azure Data Factory'],
    mandatorySkills: ['End-to-end iPaaS design', 'APIM policies', 'Hybrid connectivity (On-Prem Data Gateway, Private Endpoints)', 'DevOps for integration (Bicep/Terraform)', 'Azure security (Managed Identity, Key Vault)'],
    goodToHaveSkills: ['Event-driven & saga patterns', 'GitHub Actions / ADO pipelines', 'App Insights & Log Analytics', 'FinOps for integration', 'AZ-305 / AZ-400 certifications'],
    technicalDepthIndicators: ['Enterprise Integration Patterns (EIP)', 'Async/sync hybrid orchestration', 'OAuth2 / mTLS', 'Network isolation', 'Performance & cost optimization'],
    functionalDomainIndicators: ['Retail order/inventory/finance integration', 'Multi-region deployment', 'Compliance (GDPR, SOX)'],
    architectureExpectations: ['HLD/LLD on Azure', 'API governance', 'Zero-trust integration', 'Resilience patterns', 'Cost optimization stories'],
    leadershipExpectations: ['Led 10+ Azure integration engineers', 'Cloud governance council', 'Vendor & stakeholder management'],
    deliveryExpectations: ['2+ enterprise iPaaS platforms in production', 'Multi-region rollouts', 'SLA achievement'],
    modernizationExpectations: ['IaC (Bicep/Terraform)', 'CI/CD for Logic Apps/APIM', 'Observability', 'Event-driven modernization', 'API-first design'],
    redFlags: ['No production Azure Logic Apps/APIM', 'No IaC experience', 'Azure cert without project depth', 'Skill stacking', 'No cost-management awareness'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'Design an event-driven order processing pipeline on Azure.',
      'How would you secure an APIM-fronted integration end-to-end?',
      'Compare Logic Apps Standard vs Consumption — when to use which?',
      'Walk through your IaC strategy for a multi-region iPaaS.',
      'How do you handle poison messages in Service Bus?',
    ],
    idealSummary: 'Senior Azure integration architect with deep Logic Apps/APIM/Service Bus mastery, IaC fluency, security-first design, and proven multi-region iPaaS delivery.',
    screeningNotes: ['Validate APIM policy depth', 'Ask for cost optimization examples', 'Probe security & network design'],
  },
  {
    roleTitle: 'Functional Architect — Oracle EBS Finance & HR',
    skillFamily: 'Oracle EBS',
    seniority: 'Senior',
    minExperience: 12,
    domainContext: 'Multi-country retail finance and HR operations',
    primarySkills: ['Oracle EBS Finance (GL, AP, AR, FA, CM, EBTax)', 'Oracle EBS HR (Core HR, Payroll, SSHR, OAB, OLM)', 'Chart of Accounts design', 'Multi-org, multi-currency', 'Period close & statutory compliance'],
    mandatorySkills: ['Full-cycle EBS implementations', 'CRP/UAT leadership', 'Statutory compliance per geography', 'Payroll element design', 'Reporting (FSG, BI Publisher)'],
    goodToHaveSkills: ['Oracle Fusion / Cloud roadmap', 'EBS-to-Fusion migration awareness', 'Tax engine (Vertex, Sabrix)', 'SQL for reporting'],
    technicalDepthIndicators: ['Period-close runbook ownership', 'Multi-currency revaluation', 'Subledger Accounting (SLA) setup', 'Payroll element catalog'],
    functionalDomainIndicators: ['Retail-specific finance flows', 'GCC/India/EU statutory expertise', 'IFRS/local GAAP'],
    architectureExpectations: ['Solution blueprint ownership', 'COA strategy', 'Data migration design', 'Integration touchpoints documented'],
    leadershipExpectations: ['Led 2+ EBS implementations', 'Workshops with CFO/CHRO stakeholders', 'Vendor coordination'],
    deliveryExpectations: ['Full-lifecycle implementations', 'Go-live ownership', 'Hyper-care management', 'Measurable close-cycle reduction'],
    modernizationExpectations: ['EBS to Oracle Fusion migration awareness', 'Coexistence strategy', 'Cloud reporting (OAC)'],
    redFlags: ['EBS claimed but no period-close pain points articulated', 'HR module claimed without payroll depth', 'Only support/AMS without implementation', 'No statutory exposure'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'Walk through your last period close — top 3 challenges.',
      'Design a multi-org, multi-currency Chart of Accounts.',
      'How do you set up Payroll for a new GCC country?',
      'What is your EBS-to-Fusion migration approach?',
      'Describe SLA setup for a complex AP scenario.',
    ],
    idealSummary: 'Senior EBS Finance + HR functional architect with multi-country statutory depth, full-lifecycle implementations, and migration-path awareness.',
    screeningNotes: ['Probe period-close depth', 'Validate payroll element design', 'Ask for specific country statutory experience'],
  },
  {
    roleTitle: 'Functional Architect — Oracle RMS (Retail Merchandising)',
    skillFamily: 'Oracle Retail',
    seniority: 'Senior',
    minExperience: 12,
    domainContext: 'Tier-1/2 retail merchandising operations',
    primarySkills: ['Oracle RMS', 'ReSA', 'ReIM', 'RPM', 'SIM/SIOCS', 'Allocation', 'Stock Ledger', 'Item Hierarchy'],
    mandatorySkills: ['Item / merchandise hierarchy design', 'Stock ledger reconciliation', 'Costing (markup/markdown)', 'Promotions', 'Retail 4-5-4 calendar', 'Supplier compliance'],
    goodToHaveSkills: ['RDF (planning)', 'RIB (Retail Integration Bus)', 'BDI', 'Oracle Retail Cloud (RMFCS) migration'],
    technicalDepthIndicators: ['RMS data model fluency', 'Reconciliation runbooks', 'PL/SQL for retail reports'],
    functionalDomainIndicators: ['Apparel / grocery / electronics retail depth', 'Multi-format retail', 'Franchise vs owned'],
    architectureExpectations: ['Solution blueprint for RMS rollout', 'Integration touchpoints (RIB/BDI/OIC)', 'Data migration design'],
    leadershipExpectations: ['Led 2+ RMS implementations', 'CRP/UAT facilitation', 'Workshops with merchandising heads'],
    deliveryExpectations: ['Full-lifecycle RMS implementations', 'Specific retailer references', 'Stock ledger sign-off'],
    modernizationExpectations: ['RMS → RMFCS cloud migration', 'OIC/ICS for retail integration', 'Modern POS integration'],
    redFlags: ['RMS claimed without retailer names', 'No stock ledger experience', 'Only RPM or only SIM without core RMS', 'No retail business depth'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'How do you design an item hierarchy for a multi-format retailer?',
      'Walk through a stock ledger reconciliation issue you solved.',
      'How would you approach RMS to RMFCS migration?',
      'Describe RIB vs BDI vs OIC for retail integration.',
      'How do markdown promotions flow through RMS → RPM → ReSA?',
    ],
    idealSummary: 'Senior Oracle RMS architect with proven Tier-1 retail implementations, stock ledger and merchandising hierarchy depth, and cloud-migration awareness.',
    screeningNotes: ['Ask for specific retailer references', 'Probe stock ledger', 'Validate RPM/ReSA depth'],
  },
  {
    roleTitle: 'Architect — React Native + TypeScript',
    skillFamily: 'Mobile',
    seniority: 'Architect',
    minExperience: 10,
    domainContext: 'Cross-platform mobile apps for retail/e-commerce',
    primarySkills: ['React Native (New Architecture, Fabric, TurboModules)', 'TypeScript (advanced generics)', 'JavaScript (ES2022+)', 'Native modules (Swift/Kotlin)', 'Hermes'],
    mandatorySkills: ['Monorepo (Nx/Turborepo)', 'Offline-first design', 'State management (Redux Toolkit / Zustand)', 'Performance profiling (Flipper)', 'CI/CD (Fastlane, EAS)'],
    goodToHaveSkills: ['Reanimated 3', 'MMKV/SQLite', 'GraphQL', 'Sentry/Datadog mobile', 'App Store / Play Store release management'],
    technicalDepthIndicators: ['Native bridge code', 'Bundle optimization', 'Animation perf', 'Crash-free rate >99%', 'Code-push / OTA strategy'],
    functionalDomainIndicators: ['Retail / e-commerce mobile UX', 'Payment integrations', 'Push notifications'],
    architectureExpectations: ['Modular architecture', 'Design system for mobile', 'Micro-frontend mobile patterns', 'Security (cert pinning, biometric)'],
    leadershipExpectations: ['Led mobile team of 5+', 'Code review standards', 'Mentoring'],
    deliveryExpectations: ['2+ production apps on both stores', '100K+ users preferred', 'Store rating ≥4.5'],
    modernizationExpectations: ['New Architecture migration', 'Hermes adoption', 'Modern CI/CD', 'Observability'],
    redFlags: ['Web React experience repackaged as React Native', 'No store-published apps', 'No native module experience', 'No performance evidence'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'Walk through your most complex native module.',
      'How did you migrate to the New Architecture?',
      'How do you handle offline-first data sync?',
      'Describe your OTA update strategy.',
      'How do you optimize a sluggish list of 10K items?',
    ],
    idealSummary: 'Senior React Native architect with deep TS, native bridge fluency, production apps at scale, and modern CI/CD ownership.',
    screeningNotes: ['Verify store links', 'Ask for native code samples', 'Probe perf metrics'],
  },
  {
    roleTitle: 'Architect — JavaScript, CSS, React',
    skillFamily: 'Frontend',
    seniority: 'Architect',
    minExperience: 10,
    domainContext: 'Enterprise web apps and design systems',
    primarySkills: ['JavaScript (ES2022+)', 'TypeScript', 'React 18+ (Concurrent, Suspense, RSC)', 'Next.js / Remix', 'CSS architecture (BEM, CSS-in-JS, Tailwind)'],
    mandatorySkills: ['Design system ownership', 'Performance (Core Web Vitals)', 'Accessibility (WCAG 2.1 AA)', 'Testing (Jest, RTL, Playwright)', 'Module Federation / micro-frontends'],
    goodToHaveSkills: ['Server Components', 'Web Components', 'Storybook', 'Visual regression', 'Edge runtime'],
    technicalDepthIndicators: ['Lighthouse > 95', 'Hydration strategies', 'Code-splitting', 'Bundle size discipline'],
    functionalDomainIndicators: ['E-commerce / SaaS UI patterns', 'B2B dashboards'],
    architectureExpectations: ['Frontend platform thinking', 'Design tokens', 'Monorepo design', 'Component contracts'],
    leadershipExpectations: ['Led frontend team of 5+', 'Design system governance', 'Cross-team standards'],
    deliveryExpectations: ['2+ high-traffic React apps', 'Design system in production', 'Measurable perf improvements'],
    modernizationExpectations: ['RSC adoption', 'Turbopack/Vite', 'Edge deployment', 'AI-assisted UX'],
    redFlags: ['Only feature coding without architecture', 'No accessibility evidence', 'No perf metrics', 'No design system ownership'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'Walk through a design system you owned.',
      'How do you approach Core Web Vitals on a slow site?',
      'Compare RSC vs traditional SSR.',
      'How do you ensure a11y at scale?',
      'Design a micro-frontend architecture.',
    ],
    idealSummary: 'Senior frontend architect with design-system ownership, Core Web Vitals mastery, accessibility discipline, and modern React (RSC) fluency.',
    screeningNotes: ['Ask for design system links', 'Probe perf metrics', 'Validate a11y depth'],
  },
  {
    roleTitle: 'Architect — Oracle APEX',
    skillFamily: 'Low-code / Oracle',
    seniority: 'Architect',
    minExperience: 10,
    domainContext: 'Enterprise low-code app modernization on Oracle',
    primarySkills: ['Oracle APEX 22.x/23.x/24.x', 'PL/SQL (advanced)', 'Oracle DB tuning', 'ORDS', 'REST Data Sources'],
    mandatorySkills: ['Multi-workspace governance', 'Plugin development', 'Theme customization', 'Security (OAuth2/SAML SSO)', 'OWASP for APEX'],
    goodToHaveSkills: ['JET integration', 'OCI deployment', 'Autonomous DB', 'CI/CD (APEX Nitro, Liquibase)'],
    technicalDepthIndicators: ['Replacing Oracle Forms', 'Performance tuning APEX apps', 'Role-based access design'],
    functionalDomainIndicators: ['Replacing Excel/legacy processes', 'Internal enterprise apps'],
    architectureExpectations: ['APEX platform governance', 'Reusable component library', 'Integration with Fusion/EBS'],
    leadershipExpectations: ['Led APEX team or platform', 'Mentoring junior devs'],
    deliveryExpectations: ['3+ production APEX apps', '1+ enterprise-grade app (500+ users)'],
    modernizationExpectations: ['APEX on OCI/Autonomous', 'Git workflows', 'CI/CD'],
    redFlags: ['Forms/reports only without API integration', 'No DevOps', 'No security depth'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'How do you architect multi-workspace APEX governance?',
      'Walk through an APEX app replacing Oracle Forms.',
      'How do you secure APEX with SSO?',
      'Describe CI/CD for APEX apps.',
      'How do you tune a slow APEX page?',
    ],
    idealSummary: 'APEX architect replacing legacy systems at enterprise scale with secure, performant, integrated apps and DevOps maturity.',
    screeningNotes: ['Validate user-scale of apps', 'Ask about security model', 'Probe DevOps maturity'],
  },
  {
    roleTitle: 'Architect — Python + ML Algorithms + GenAI',
    skillFamily: 'AI / Data Science',
    seniority: 'Architect',
    minExperience: 10,
    domainContext: 'Production ML and GenAI for retail',
    primarySkills: ['Python (advanced)', 'Classical ML (sklearn, XGBoost)', 'Deep Learning (PyTorch/TensorFlow)', 'LLM / GenAI', 'RAG architecture', 'Vector DBs (Pinecone, pgvector, Weaviate)'],
    mandatorySkills: ['Production ML deployments', 'MLOps (MLflow, Kubeflow, Vertex AI / Azure ML)', 'Model evaluation & monitoring', 'Drift / bias detection', 'GenAI in production'],
    goodToHaveSkills: ['LangChain / LlamaIndex', 'Agent frameworks', 'Feature stores', 'Spark/Dask', 'Lakehouse (Delta/Iceberg)'],
    technicalDepthIndicators: ['End-to-end ML platform design', 'Fine-tuning LLMs', 'RAG with measurable accuracy', 'Responsible AI'],
    functionalDomainIndicators: ['Retail forecasting / personalization / recommendation', 'Customer support GenAI'],
    architectureExpectations: ['ML platform design', 'Model governance', 'Cost optimization', 'Multi-modal pipelines'],
    leadershipExpectations: ['Led data science team', 'Stakeholder communication', 'Ethics review participation'],
    deliveryExpectations: ['2+ production ML models with business impact', '1+ GenAI/LLM in production'],
    modernizationExpectations: ['GenAI/RAG/Agents', 'LLMOps', 'Modern data stack'],
    redFlags: ['Python/ML without GenAI in 2026', 'POC-only experience', 'No measurable business impact', 'No MLOps'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'Walk through a GenAI/RAG system you put in production.',
      'How do you evaluate LLM output quality?',
      'Describe drift monitoring for a recommender.',
      'How do you decide fine-tuning vs prompting vs RAG?',
      'Compare vector DBs you have used.',
    ],
    idealSummary: 'Senior Python/ML architect with production GenAI/RAG, MLOps fluency, and measurable business outcomes — 2026-ready.',
    screeningNotes: ['Probe GenAI production depth', 'Ask for measurable outcomes', 'Validate MLOps tools'],
  },
  {
    roleTitle: 'Architect — PimCore',
    skillFamily: 'PIM / DAM / MDM',
    seniority: 'Architect',
    minExperience: 10,
    domainContext: 'Product Information Management for omnichannel retail',
    primarySkills: ['PimCore 10/11', 'PHP 8+', 'Symfony framework', 'MySQL/MariaDB tuning', 'Data modeling for products'],
    mandatorySkills: ['Classification stores', 'Multi-channel publishing', 'DAM workflows', 'API-first (REST/GraphQL)', 'Headless integration'],
    goodToHaveSkills: ['Docker/K8s', 'CI/CD', 'GS1/BMEcat syndication', 'SAP Hybris / Magento / Shopify integration'],
    technicalDepthIndicators: ['Data model fluency', 'Performance tuning at 10K+ SKUs', 'Custom workflow design'],
    functionalDomainIndicators: ['Omnichannel retail', 'Apparel / grocery / electronics catalog'],
    architectureExpectations: ['Headless commerce integration', 'Event-driven sync', 'Multi-environment design'],
    leadershipExpectations: ['Led PimCore team', 'Stakeholder workshops with merchandising'],
    deliveryExpectations: ['2+ PimCore implementations at enterprise scale', '10K+ SKUs', '1+ omnichannel publishing setup'],
    modernizationExpectations: ['Headless commerce', 'Modern API design', 'Cloud deployment'],
    redFlags: ['Generic PHP/Symfony without PimCore depth', 'No data modeling experience', 'No enterprise scale'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'How do you design a PimCore data model for fashion?',
      'Walk through a multi-channel publishing setup.',
      'How do you integrate PimCore with ERP and e-commerce?',
      'Describe DAM workflow design.',
      'How do you tune PimCore for 100K+ SKUs?',
    ],
    idealSummary: 'PimCore architect with deep data modeling, omnichannel publishing, and enterprise-scale delivery at retailers.',
    screeningNotes: ['Probe SKU scale', 'Ask for data model samples', 'Validate ERP integration'],
  },
  {
    roleTitle: 'Senior Data Analyst — Retail Analytics',
    skillFamily: 'Data & Analytics',
    seniority: 'Senior',
    minExperience: 5,
    domainContext: 'Retail BI, dashboards, business insight delivery',
    primarySkills: ['SQL (advanced)', 'Power BI / Tableau', 'Python (pandas)', 'Data modeling', 'Excel (advanced)'],
    mandatorySkills: ['Retail KPI design', 'Storytelling with data', 'Stakeholder management', 'Data quality / validation'],
    goodToHaveSkills: ['DAX', 'dbt', 'Snowflake / BigQuery / Synapse', 'A/B testing', 'Forecasting'],
    technicalDepthIndicators: ['Complex SQL (windowing, CTEs)', 'Dashboard performance tuning', 'Data validation rigor'],
    functionalDomainIndicators: ['Sales / inventory / customer / marketing analytics', 'Retail seasonality awareness'],
    architectureExpectations: ['Semantic model design', 'Star schema fluency', 'Data lineage'],
    leadershipExpectations: ['Mentored juniors', 'Stakeholder workshops', 'Cross-team collaboration'],
    deliveryExpectations: ['Production dashboards with measurable adoption', 'Insight reports leading to decisions'],
    modernizationExpectations: ['Modern data stack', 'Self-service analytics enablement', 'AI-assisted analysis'],
    redFlags: ['Only Excel without SQL', 'No business outcome examples', 'No stakeholder management'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'Walk through a dashboard that changed a business decision.',
      'Write SQL to find top-10 stores by week-over-week growth.',
      'How do you validate data quality before publishing a dashboard?',
      'Compare Power BI vs Tableau for retail.',
      'How do you forecast weekly sales for a seasonal category?',
    ],
    idealSummary: 'Senior data analyst with retail KPI fluency, advanced SQL, BI tool mastery, and storytelling that drives decisions.',
    screeningNotes: ['Ask for dashboard URLs/screenshots', 'Test SQL live', 'Probe business impact'],
  },
  {
    roleTitle: 'Technical Lead — Full-Stack Generalist',
    skillFamily: 'Full-Stack',
    seniority: 'Lead',
    minExperience: 8,
    domainContext: 'Modern full-stack web product delivery',
    primarySkills: ['JavaScript/TypeScript', 'React / Next.js', 'Node.js', 'SQL & NoSQL', 'Git / CI/CD'],
    mandatorySkills: ['Leading 3–6 developers', 'Code review discipline', 'Testing strategy', 'Cloud deployment', 'Performance discipline'],
    goodToHaveSkills: ['Docker/K8s', 'Observability', 'Security best practices', 'GenAI integration'],
    technicalDepthIndicators: ['End-to-end feature ownership', 'Performance optimization stories', 'Production debugging'],
    functionalDomainIndicators: ['Retail / e-commerce / B2B SaaS'],
    architectureExpectations: ['Module-level design ownership', 'Tech debt management', 'API contracts'],
    leadershipExpectations: ['Led 3–6 devs for 1+ year', 'Mentoring', 'Sprint planning'],
    deliveryExpectations: ['2+ production releases owned', 'Customer-facing features shipped'],
    modernizationExpectations: ['Modern stack adoption', 'DevOps maturity', 'AI-assisted coding'],
    redFlags: ['Only coder without leadership', 'No production debugging stories', 'No mentoring'],
    weights: DEFAULT_WEIGHTS,
    interviewQuestions: [
      'Walk through a production incident you led to resolution.',
      'How do you mentor a struggling developer?',
      'Design API contracts for a multi-team feature.',
      'How do you balance tech debt vs features?',
      'Describe your testing strategy.',
    ],
    idealSummary: 'Hands-on technical lead with full-stack fluency, proven team leadership, and production delivery discipline.',
    screeningNotes: ['Probe leadership stories', 'Ask for incident resolution', 'Validate mentoring'],
  },
];

/**
 * Token-overlap match. Returns the template with the highest shared-token
 * count between the input role title and the template's roleTitle + skillFamily.
 * Falls back to undefined if no template scores above the threshold so the
 * caller can decide whether to take a default vs a tailored template.
 */
export function findTemplateByRole(roleTitle: string): BenchmarkTemplate | undefined {
  const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'a', 'of', 'in', 'sr', 'senior', 'lead', 'architect', 'engineer', 'developer']);
  const tokenize = (s: string): Set<string> =>
    new Set(
      s.toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
    );

  const queryTokens = tokenize(roleTitle);
  if (queryTokens.size === 0) return undefined;

  let bestScore = 0;
  let best: BenchmarkTemplate | undefined;

  for (const tpl of BENCHMARK_TEMPLATES) {
    const tplTokens = new Set([
      ...tokenize(tpl.roleTitle),
      ...tokenize(tpl.skillFamily),
      ...tpl.primarySkills.flatMap((s) => Array.from(tokenize(s))),
    ]);
    let overlap = 0;
    for (const t of queryTokens) if (tplTokens.has(t)) overlap++;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = tpl;
    }
  }

  // Require at least 1 meaningful token overlap.
  return bestScore >= 1 ? best : undefined;
}
