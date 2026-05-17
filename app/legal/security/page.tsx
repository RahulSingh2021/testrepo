import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Security Audit | HACCP PRO',
  description: 'Our approach to platform security, audits and compliance.',
};

export default function SecurityRoute() {
  return (
    <LegalPage
      title="Security & Audits"
      lastUpdated="May 2026"
      sections={[
        {
          heading: 'Platform security',
          body: `HACCP PRO runs on managed infrastructure with encrypted
storage, automated backups and least-privilege access. Admin
sessions are short-lived and protected by per-request token
checks.`,
        },
        {
          heading: 'Application security',
          body: `Our application code is reviewed before release. Public
content is sanitised before render to prevent script injection,
and write endpoints require an authenticated admin session.`,
        },
        {
          heading: 'Customer data isolation',
          body: `Each organisation's records, learners and audit data are
scoped by tenant and entity hierarchy so users only see the
records they are entitled to.`,
        },
        {
          heading: 'Reporting a vulnerability',
          body: `If you believe you have found a security issue, please email
hello@haccppro.com with the details. We acknowledge reports
within two business days.`,
        },
      ]}
    />
  );
}
