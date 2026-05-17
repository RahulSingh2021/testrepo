import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Privacy Policy | HACCP PRO',
  description: 'How HACCP PRO collects, stores and protects your data.',
};

export default function PrivacyRoute() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="May 2026"
      sections={[
        {
          heading: 'Information we collect',
          body: `We collect the information you provide when you create an
account, set up your organisation and use HACCP PRO — including
contact details, kitchen and unit metadata, audit and training
records, and the documents you upload.`,
        },
        {
          heading: 'How we use your information',
          body: `We use your data to operate the HACCP PRO platform, deliver
training and audit features, generate compliance reports, send
service-related notifications and improve the product. We do not
sell your personal data to third parties.`,
        },
        {
          heading: 'Data storage and security',
          body: `Your data is stored on secure managed infrastructure with
encryption in transit. Access is restricted to authorised
personnel and audited regularly. You can request deletion of
your account and associated data at any time by contacting us.`,
        },
        {
          heading: 'Contact',
          body: `For privacy queries, email us at hello@haccppro.com or via
the WhatsApp number listed on the contact section of the home
page.`,
        },
      ]}
    />
  );
}
