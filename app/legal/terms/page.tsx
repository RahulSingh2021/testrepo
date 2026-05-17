import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Terms of Service | HACCP PRO',
  description: 'The terms that govern your use of the HACCP PRO platform.',
};

export default function TermsRoute() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="May 2026"
      sections={[
        {
          heading: 'Acceptance',
          body: `By creating an account or using HACCP PRO you agree to these
terms. If you do not agree, please do not use the service.`,
        },
        {
          heading: 'Your account',
          body: `You are responsible for the accuracy of the information you
upload, for keeping your credentials confidential and for the
activity of users under your organisation.`,
        },
        {
          heading: 'Acceptable use',
          body: `You may not use HACCP PRO to upload unlawful content, attempt
to disrupt the service, scrape data without permission, or
circumvent the access controls of other tenants.`,
        },
        {
          heading: 'Service availability',
          body: `We work hard to keep HACCP PRO available, but the service is
provided on an "as is" basis. Scheduled maintenance windows
will be communicated in advance where possible.`,
        },
        {
          heading: 'Termination',
          body: `Either party may terminate the relationship with reasonable
notice. Upon termination you may export your records before
your account is closed.`,
        },
      ]}
    />
  );
}
