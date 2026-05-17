// Curated seed openings used as a fallback when the admin hasn't
// posted any jobs yet (e.g. a fresh install). The same dataset is
// shared by the public list page (components/JobsPage.tsx) and the
// detail page (components/JobDetailPage.tsx) so opening /jobs/j1 on
// a fresh database still resolves to a real-looking record instead
// of a "Job not found" wall.

export interface FallbackJob {
  id: string;
  title: string;
  company: string;
  location: string;
  city: string;
  experience: string;
  salary: string;
  employment: 'Full-time' | 'Contract' | 'Remote';
  area: 'Quality' | 'Production' | 'Regulatory' | 'R&D';
  source: string;
  posted_on: string;
  promoted: boolean;
  apply_url: string;
  description: string;
  requirements: string[];
  skills: string[];
}

const ago = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

export const FALLBACK_JOBS: FallbackJob[] = [
  {
    id: 'j1',
    title: 'Senior Quality Assurance Manager',
    company: 'Britannia Industries',
    location: 'Bangalore, Karnataka',
    city: 'Bangalore',
    experience: '8-12 years',
    salary: '₹18-25 LPA',
    employment: 'Full-time',
    area: 'Quality',
    source: 'Naukri',
    posted_on: ago(48),
    promoted: true,
    apply_url: 'https://www.naukri.com/',
    description:
      "Lead the QA function across 4 manufacturing sites. Own HACCP, FSSC 22000 surveillance audits, and recall readiness. Partner with R&D on new-product launches and drive a step-change in our supplier-quality program.",
    requirements: [
      'B.Tech / M.Sc. in Food Tech, Microbiology, or related',
      '8+ years in food manufacturing QA, with at least 3 leading a team',
      'Hands-on with FSSC 22000, HACCP, and BRCGS audits',
      'Experience driving CAPA closure across multi-site operations',
    ],
    skills: ['HACCP', 'FSSC 22000', 'BRCGS', 'Internal Audits', 'CAPA', 'Team Leadership'],
  },
  {
    id: 'j2',
    title: 'Food Safety Officer (FSO)',
    company: 'State Food Department',
    location: 'Lucknow, Uttar Pradesh',
    city: 'Lucknow',
    experience: '2-5 years',
    salary: '₹6-9 LPA',
    employment: 'Full-time',
    area: 'Regulatory',
    source: 'Government',
    posted_on: ago(5),
    promoted: false,
    apply_url: 'https://www.fssai.gov.in/',
    description:
      'Conduct food safety inspections at FBOs across the assigned district. Collect samples, draft show-cause notices, and represent the department in adjudication proceedings.',
    requirements: [
      'M.Sc. in Food Tech / Dairy Tech / Veterinary Science',
      'FSSAI FSO eligibility certificate',
      'Working knowledge of FSS Act 2006 and supporting rules',
    ],
    skills: ['FSSAI', 'Inspections', 'Sampling', 'Regulatory Reporting'],
  },
  {
    id: 'j3',
    title: 'Production Supervisor (Dairy)',
    company: 'Amul (GCMMF)',
    location: 'Anand, Gujarat',
    city: 'Anand',
    experience: '4-7 years',
    salary: '₹8-11 LPA',
    employment: 'Full-time',
    area: 'Production',
    source: 'Indeed',
    posted_on: ago(72),
    promoted: false,
    apply_url: 'https://www.indeed.co.in/',
    description: 'Run a dairy processing shift. Own shift KPIs, line clearance, and CIP cycles.',
    requirements: ['B.Tech Dairy Tech', 'Hands-on with UHT / pasteurisation lines'],
    skills: ['Dairy Processing', 'CIP', 'Line Clearance'],
  },
  {
    id: 'j4',
    title: 'Regulatory Affairs Specialist',
    company: 'Hindustan Unilever (HUL)',
    location: 'Mumbai, Maharashtra',
    city: 'Mumbai',
    experience: '5-8 years',
    salary: '₹15-22 LPA',
    employment: 'Full-time',
    area: 'Regulatory',
    source: 'LinkedIn',
    posted_on: ago(168),
    promoted: false,
    apply_url: 'https://www.linkedin.com/jobs/',
    description: 'Own label compliance and FSSAI dossiers for the foods portfolio.',
    requirements: ['M.Sc. Food Tech', '5+ yrs in regulatory affairs at an FBO'],
    skills: ['FSSAI Labelling', 'Codex', 'Health Claims'],
  },
  {
    id: 'j5',
    title: 'R&D Scientist – Plant-Based Foods',
    company: 'ITC Foods',
    location: 'Bengaluru, Karnataka',
    city: 'Bengaluru',
    experience: '3-6 years',
    salary: '₹12-18 LPA',
    employment: 'Full-time',
    area: 'R&D',
    source: 'Naukri',
    posted_on: ago(96),
    promoted: false,
    apply_url: 'https://www.naukri.com/',
    description: 'Develop plant-protein-based dairy and meat analogues from concept to pilot.',
    requirements: ['M.Sc. / Ph.D. Food Science', 'Pilot-plant experience'],
    skills: ['Product Development', 'Plant Proteins', 'Sensory'],
  },
  {
    id: 'j6',
    title: 'HACCP Consultant (Remote)',
    company: 'FoodSafe Advisors',
    location: 'Remote (India)',
    city: 'Remote',
    experience: '6-10 years',
    salary: '₹20-30 LPA',
    employment: 'Remote',
    area: 'Quality',
    source: 'LinkedIn',
    posted_on: ago(24),
    promoted: false,
    apply_url: 'https://www.linkedin.com/jobs/',
    description: 'Lead HACCP implementation projects for SME food businesses across India.',
    requirements: ['Lead Auditor certification (FSSC 22000 or BRCGS)', 'Consulting background'],
    skills: ['HACCP', 'GMP', 'PRPs', 'Training Delivery'],
  },
  {
    id: 'j7',
    title: 'QA Auditor – Contract (3 months)',
    company: 'Nestlé India',
    location: 'Gurugram, Haryana',
    city: 'Gurugram',
    experience: '4-6 years',
    salary: '₹10-14 LPA',
    employment: 'Contract',
    area: 'Quality',
    source: 'Naukri',
    posted_on: ago(12),
    promoted: false,
    apply_url: 'https://www.naukri.com/',
    description: 'Audit external co-packers across North India over a 3-month engagement.',
    requirements: ['ISO 22000 Lead Auditor', 'Open to 60% travel'],
    skills: ['Supplier Audits', 'ISO 22000', 'Reporting'],
  },
];
