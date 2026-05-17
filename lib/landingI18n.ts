'use client';

import { useEffect, useState } from 'react';

// Lightweight i18n for the public marketing surface (landing page +
// news reader). We intentionally avoid pulling in a full i18n
// framework — every string lives in a single typed catalog so the
// TypeScript compiler keeps `en` and `hi` in lock-step.

export type LandingLang = 'en' | 'hi';

export interface LandingLanguageOption {
  code: LandingLang;
  /** English name used in the language picker for screen-readers. */
  label: string;
  /** Native script label shown to the user. */
  nativeLabel: string;
  /** Compact 2-letter chip used in the top-bar pill. */
  short: string;
  /** BCP-47 locale used for date / number formatting. */
  locale: string;
}

export const LANDING_LANGUAGES: LandingLanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', short: 'EN', locale: 'en-IN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', short: 'हिं', locale: 'hi-IN' },
];

const STORAGE_KEY = 'haccppro:landing-lang';
const CHANGE_EVENT = 'haccppro:landing-lang-change';

const isLandingLang = (v: unknown): v is LandingLang => v === 'en' || v === 'hi';

export const getStoredLandingLang = (): LandingLang => {
  if (typeof window === 'undefined') return 'en';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLandingLang(v) ? v : 'en';
  } catch {
    return 'en';
  }
};

export const setStoredLandingLang = (lang: LandingLang) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore quota / privacy-mode failures */
  }
  window.dispatchEvent(new CustomEvent<LandingLang>(CHANGE_EVENT, { detail: lang }));
};

/**
 * Read + write the visitor's preferred language. The hook keeps every
 * mounted subscriber on the same page in sync via a custom event and
 * also reacts to the native `storage` event so other tabs update too.
 */
export const useLandingLanguage = (): [LandingLang, (l: LandingLang) => void] => {
  const [lang, setLang] = useState<LandingLang>('en');

  useEffect(() => {
    setLang(getStoredLandingLang());
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<LandingLang>).detail;
      if (isLandingLang(detail)) setLang(detail);
      else setLang(getStoredLandingLang());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== STORAGE_KEY) return;
      setLang(getStoredLandingLang());
    };
    window.addEventListener(CHANGE_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = (next: LandingLang) => {
    setStoredLandingLang(next);
    setLang(next);
  };

  return [lang, update];
};

// ── Strings catalog ───────────────────────────────────────────────────────
export interface LandingStrings {
  // Top bar / chrome
  navHome: string;
  navTraining: string;
  navTips: string;
  navNews: string;
  navJobs: string;
  navCourses: string;
  signIn: string;
  whatsapp: string;
  openMenu: string;
  closeMenu: string;
  menu: string;
  haccpProHome: string;
  language: string;
  brandTagline: string;

  // Hero
  heroEyebrow: string;
  heroTitleA: string;
  heroTitleHighlight: string;
  heroTitleB: string;
  heroSubtitle: string;
  browseCourses: string;

  // Trust strip
  trustValueLearners: string;
  trustLabelLearners: string;
  trustValueCurriculum: string;
  trustLabelCurriculum: string;
  trustValueAuditPass: string;
  trustLabelAuditPass: string;

  // Training section
  trainingEyebrow: string;
  trainingTitle: string;
  trainingSubtitle: string;
  loadingSessions: string;
  noTrainingsTitle: string;
  noTrainingsBody: string;
  cardTrainerLabel: string;
  cardRegister: string;

  // Tips section
  tipsEyebrow: string;
  tipsTitle: string;
  tipsSubtitle: string;
  loadingTips: string;
  noTipsTitle: string;
  noTipsBody: string;
  tipOfTheDay: string;
  untitledTip: string;

  // News section — Live Intelligence Feed
  newsEyebrow: string;
  newsTitle: string;
  newsSubtitle: string;
  newsRegulatoryTitle: string;
  newsIndustryTitle: string;
  newsRegulatoryEmpty: string;
  newsIndustryEmpty: string;
  newsIndustryEmptyNoKeywords: string;
  newsNewPill: string;
  newsViewAll: string;
  newsViewAllAria: string;
  loadingNews: string;
  noNewsTitle: string;
  noNewsBody: string;
  untitledArticle: string;
  cardMinRead: string;
  cardRead: string;

  // Dedicated /news landing page
  latestNewsHeroTitlePrefix: string;
  latestNewsHeroTitleHighlight: string;
  latestNewsHeroSubtitle: string;
  latestNewsSearchPlaceholder: string;
  latestNewsRegulatoryTitle: string;
  latestNewsIndustryTitle: string;
  latestNewsRegulatoryEmptyTitle: string;
  latestNewsIndustryEmptyTitle: string;
  latestNewsIndustryEmptyNoKeywordsTitle: string;
  latestNewsIndustryEmptyNoKeywordsBody: string;
  latestNewsEmptyBody: string;
  latestNewsChipAll: string;
  latestNewsUpdatesCount: (n: number) => string;
  latestNewsOfficialGazette: string;
  latestNewsGoogleNews: string;
  latestNewsCtaPill: string;
  latestNewsCtaTitle: string;
  latestNewsCtaSubtitle: string;
  latestNewsCtaButton: string;
  latestNewsFeaturedPill: string;
  latestNewsLoadMore: string;
  latestNewsLoadingMore: string;
  latestNewsShowingCount: (shown: number, total: number) => string;
  latestNewsShare: string;
  latestNewsShareCopied: string;

  // Courses section
  coursesEyebrow: string;
  coursesTitle: string;
  coursesSubtitle: string;
  searchCourses: string;
  allLevels: string;
  loadingCourses: string;
  noCoursesTitle: string;
  noCoursesBody: string;
  cardLessonsLabel: string;
  cardStudentsLabel: string;
  untitledCourse: string;
  free: string;

  // Why HACCP PRO
  whyEyebrow: string;
  whyTitle: string;
  whySubtitle: string;
  featSmartAuditsTitle: string;
  featSmartAuditsBody: string;
  featTrainingTitle: string;
  featTrainingBody: string;
  featRecordsTitle: string;
  featRecordsBody: string;
  featRealtimeTitle: string;
  featRealtimeBody: string;

  // CTA banner
  ctaPill: string;
  ctaTitle: string;
  ctaSubtitle: string;
  talkToUs: string;

  // Footer
  footerTagline: string;
  footerQuickLinks: string;
  footerContact: string;
  footerLegal: string;
  footerPrivacy: string;
  footerTerms: string;
  footerSecurity: string;
  footerFollow: string;
  footerCopyright: (year: number) => string;
  footerTrustedBy: string;
  footerWhatsapp: string;

  // Hero illustration
  illustComplianceDashboard: string;
  illustAuditsPassed: string;
  illustActiveLearners: string;
  illustOpenTasks: string;
  illustCertificates: string;
  illustTodaysFocus: string;
  illustTodaysFocusBody: string;

  // News reader page
  newsBackToNews: string;
  newsLoading: string;
  newsNotFoundTitle: string;
  newsNotFoundBody: string;
  newsReturnHome: string;
  newsBy: string;
  newsCoverAlt: string;
  untitledTraining: string;

  // Tips reader page (mirrors news reader copy)
  tipsBackToTips: string;
  tipsLoading: string;
  tipsNotFoundTitle: string;
  tipsNotFoundBody: string;
  tipReadFull: string;

  // Share button (used by both news + tips reader pages)
  shareLabel: string;
  shareCopied: string;

  tipMarketingRecommendedTrainingEyebrow: string;
  tipMarketingRecommendedTrainingTitle: string;
  tipMarketingRecommendedTrainingFallbackTitle: string;
  tipMarketingTakeFullCourseEyebrow: string;
  tipMarketingTakeFullCourseTitle: string;
  tipMarketingExploreCourse: string;
  tipMarketingTrustEyebrow: string;
  tipMarketingTrustFssai: string;
  tipMarketingTrustHaccp: string;
  tipMarketingTrustIso: string;
  tipMarketingLeadFormTitle: string;
  tipMarketingLeadFormSubtitle: string;
  tipMarketingLeadFormName: string;
  tipMarketingLeadFormEmail: string;
  tipMarketingLeadFormPhone: string;
  tipMarketingLeadFormSubmit: string;
  tipMarketingLeadFormSubmitting: string;
  tipMarketingLeadFormSuccess: string;
  tipMarketingLeadFormSuccessBody: string;
  tipMarketingLeadFormError: string;
  tipMarketingLeadFormInvalidEmail: string;
  tipMarketingLeadFormRequired: string;
  tipMarketingLeadFormConsent: string;
  tipMarketingStickyTitle: string;
  tipMarketingStickyOnDate: string;
  tipMarketingQrTitle: string;
  tipMarketingQrSubtitle: string;
  tipMarketingDefaultCtaHeadline: string;
  tipMarketingDefaultCtaButton: string;
  tipMarketingTrainerLabel: string;
  tipMarketingPrintLabel: string;

  // Redesigned tip-detail page (sidebar + body framing)
  tipsBodyHeading: string;
  tipsAuditorNoteTitle: string;
  tipsSidebarPromoEyebrow: string;
  tipsSidebarPromoTitle: string;
  tipsSidebarPromoBody: string;
  tipsSidebarPromoButton: string;
  tipsSidebarCategoriesTitle: string;
  tipsSidebarSubscribeTitle: string;
  tipsSidebarSubscribeBody: string;
  tipsSidebarSubscribeButton: string;
  tipsSidebarSubscribeEmailPlaceholder: string;
  tipsNextTipLabel: string;
}

const EN: LandingStrings = {
  navHome: 'Home',
  navTraining: 'Training',
  navTips: 'Daily Tips',
  navNews: 'Food Safety News',
  navJobs: 'Jobs',
  navCourses: 'Training Courses',
  signIn: 'Sign In',
  whatsapp: 'WhatsApp',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  menu: 'Menu',
  haccpProHome: 'HACCP PRO home',
  language: 'Language',
  brandTagline: 'Food Safety Intelligence',

  heroEyebrow: 'Food Safety Intelligence',
  heroTitleA: 'Build a culture of ',
  heroTitleHighlight: 'food safety',
  heroTitleB: ' your auditors will love.',
  heroSubtitle:
    'HACCP PRO turns daily kitchen routines into audit-ready records. Train your team, monitor compliance in real-time and stay ahead of every regulatory change with one connected platform.',
  browseCourses: 'Browse courses',

  trustValueLearners: '10K+',
  trustLabelLearners: 'Learners trained',
  trustValueCurriculum: 'ISO 22000',
  trustLabelCurriculum: 'Aligned curriculum',
  trustValueAuditPass: '99.9%',
  trustLabelAuditPass: 'Audit pass rate',

  trainingEyebrow: 'Live training calendar',
  trainingTitle: 'Upcoming live training sessions',
  trainingSubtitle:
    'Reserve a seat in our next instructor-led training. All sessions are delivered by certified food-safety auditors and come with a digital attendance certificate.',
  loadingSessions: 'Loading sessions…',
  noTrainingsTitle: 'No live trainings scheduled',
  noTrainingsBody:
    'We\u2019re lining up the next batch of sessions. Check back soon or sign in to be notified.',
  cardTrainerLabel: 'Trainer',
  cardRegister: 'Register',

  tipsEyebrow: 'Daily food safety tips',
  tipsTitle: 'Bite-sized advice for safer kitchens',
  tipsSubtitle:
    'Quick, practical tips your team can apply on shift — short protocols, hygiene reminders and best practices, all in one place.',
  loadingTips: 'Loading tips…',
  noTipsTitle: 'No tips published yet',
  noTipsBody: 'Our content team is preparing the first batch — check back tomorrow.',
  tipOfTheDay: 'Tip of the day',
  untitledTip: 'Untitled tip',

  newsEyebrow: 'Live Intelligence Feed',
  newsTitle: 'Stay ahead of the curve',
  newsSubtitle:
    'Curated updates on FSSAI, HACCP, ISO 22000 and global food-safety trends written for plant managers and QA leads.',
  newsRegulatoryTitle: 'Regulatory Updates',
  newsIndustryTitle: 'Industry Trends',
  newsRegulatoryEmpty: 'No regulatory updates yet',
  newsIndustryEmpty: 'No industry trends yet',
  newsIndustryEmptyNoKeywords: 'No keywords configured yet',
  newsNewPill: 'New',
  newsViewAll: 'View all',
  newsViewAllAria: 'View all news',
  loadingNews: 'Loading articles…',
  noNewsTitle: 'No news posts yet',
  noNewsBody: 'The first stories will land here once our editors hit publish.',
  untitledArticle: 'Untitled article',
  cardMinRead: 'min read',
  cardRead: 'Read',

  latestNewsHeroTitlePrefix: 'Global Safety',
  latestNewsHeroTitleHighlight: 'Intelligence',
  latestNewsHeroSubtitle:
    'Authorized regulatory updates and curated industry news to help your business stay compliant.',
  latestNewsSearchPlaceholder: 'Search news, updates, regulators…',
  latestNewsRegulatoryTitle: 'Regulatory & Compliance Updates',
  latestNewsIndustryTitle: 'Industry Trends & General News',
  latestNewsRegulatoryEmptyTitle: 'No matching regulatory updates',
  latestNewsIndustryEmptyTitle: 'No matching industry news',
  latestNewsIndustryEmptyNoKeywordsTitle: 'No keywords configured yet',
  latestNewsIndustryEmptyNoKeywordsBody:
    'An admin needs to add at least one Google News keyword in the Academy Admin panel before industry headlines can appear here.',
  latestNewsEmptyBody: 'Try clearing the search or selecting a different category.',
  latestNewsChipAll: 'All',
  latestNewsUpdatesCount: (n: number) => `${n} ${n === 1 ? 'Update' : 'Updates'}`,
  latestNewsOfficialGazette: 'Official Gazette',
  latestNewsGoogleNews: 'Google News',
  latestNewsCtaPill: 'HACCP PRO Academy',
  latestNewsCtaTitle: 'Don\u2019t just read news. Lead the standard.',
  latestNewsCtaSubtitle:
    'Turn every regulatory update into action. Enroll your team in certified food-safety courses and stay ahead of every audit.',
  latestNewsCtaButton: 'Explore Academy',
  latestNewsFeaturedPill: 'Featured',
  latestNewsLoadMore: 'Load more',
  latestNewsLoadingMore: 'Loading more…',
  latestNewsShowingCount: (shown: number, total: number) =>
    `Showing ${shown} of ${total}`,
  latestNewsShare: 'Share article',
  latestNewsShareCopied: 'Link copied',

  coursesEyebrow: 'Training courses',
  coursesTitle: 'On-demand course catalogue',
  coursesSubtitle:
    'Self-paced certifications across HACCP, food hygiene, allergen management and more. Browse, enrol and start in minutes.',
  searchCourses: 'Search courses…',
  allLevels: 'All levels',
  loadingCourses: 'Loading courses…',
  noCoursesTitle: 'No active courses found',
  noCoursesBody:
    'Try a different search term or come back soon — we publish new content every month.',
  cardLessonsLabel: 'Lessons',
  cardStudentsLabel: 'Students',
  untitledCourse: 'Untitled course',
  free: 'Free',

  whyEyebrow: 'Why HACCP PRO',
  whyTitle: 'One platform for the whole compliance lifecycle',
  whySubtitle:
    'From the kitchen line to the boardroom — HACCP PRO connects training, audits and records into a single, certificate-ready trail.',
  featSmartAuditsTitle: 'Smart audits',
  featSmartAuditsBody:
    'Mobile-first audit checklists with photo evidence, scoring and instant reports your auditors can sign in seconds.',
  featTrainingTitle: 'Training & LMS',
  featTrainingBody:
    'Assign courses, track completion and award certificates without juggling spreadsheets.',
  featRecordsTitle: 'Records & traceability',
  featRecordsBody:
    'HACCP records, temperature logs and supplier docs in one searchable, audit-ready vault.',
  featRealtimeTitle: 'Real-time compliance',
  featRealtimeBody:
    'Live dashboards flag overdue tasks, expiring licences and at-risk units before the regulator does.',

  ctaPill: 'Free 14-day trial',
  ctaTitle: 'Ready to make your next audit a non-event?',
  ctaSubtitle:
    'Sign in to your HACCP PRO workspace or talk to our team about rolling it out across your kitchens, units or supply chain.',
  talkToUs: 'Talk to us',

  footerTagline:
    'HACCP PRO helps food businesses stay audit-ready with training, digital records and real-time compliance monitoring.',
  footerQuickLinks: 'Quick links',
  footerContact: 'Contact',
  footerLegal: 'Legal',
  footerPrivacy: 'Privacy Policy',
  footerTerms: 'Terms of Service',
  footerSecurity: 'Security Audit',
  footerFollow: 'Follow',
  footerCopyright: (year) => `© ${year} HACCP PRO Global Systems`,
  footerTrustedBy: 'Trusted by food businesses worldwide',
  footerWhatsapp: 'WhatsApp',

  illustComplianceDashboard: 'Compliance dashboard',
  illustAuditsPassed: 'Audits passed',
  illustActiveLearners: 'Active learners',
  illustOpenTasks: 'Open tasks',
  illustCertificates: 'Certificates',
  illustTodaysFocus: 'Today\u2019s focus',
  illustTodaysFocusBody: 'Cold-chain temperature checks at 6 units due before 4 PM.',

  newsBackToNews: 'Back to news',
  newsLoading: 'Loading article…',
  newsNotFoundTitle: 'Sorry, that article is no longer available.',
  newsNotFoundBody: 'It may have been unpublished or removed.',
  newsReturnHome: 'Return home',
  newsBy: 'By',
  newsCoverAlt: 'News cover',
  untitledTraining: 'Untitled training',

  tipsBackToTips: 'Back to tips',
  tipsLoading: 'Loading tip…',
  tipsNotFoundTitle: 'Sorry, that tip is no longer available.',
  tipsNotFoundBody: 'It may have been unpublished or removed.',
  tipReadFull: 'Read tip',

  shareLabel: 'Share',
  shareCopied: 'Link copied',

  tipMarketingRecommendedTrainingEyebrow: 'Recommended training',
  tipMarketingRecommendedTrainingTitle: 'Turn this tip into team-wide practice',
  tipMarketingRecommendedTrainingFallbackTitle: 'Upcoming live training sessions',
  tipMarketingTakeFullCourseEyebrow: 'Self-paced course',
  tipMarketingTakeFullCourseTitle: 'Take the full course',
  tipMarketingExploreCourse: 'Explore course',
  tipMarketingTrustEyebrow: 'Aligned with',
  tipMarketingTrustFssai: 'FSSAI guidance',
  tipMarketingTrustHaccp: 'HACCP principles',
  tipMarketingTrustIso: 'ISO 22000',
  tipMarketingLeadFormTitle: 'Get the next food-safety tip + training updates',
  tipMarketingLeadFormSubtitle:
    'One short email a week with a fresh tip and the next live training. Unsubscribe any time.',
  tipMarketingLeadFormName: 'Your name',
  tipMarketingLeadFormEmail: 'Email address',
  tipMarketingLeadFormPhone: 'Phone (optional, WhatsApp)',
  tipMarketingLeadFormSubmit: 'Subscribe',
  tipMarketingLeadFormSubmitting: 'Sending…',
  tipMarketingLeadFormSuccess: 'Thanks! You\u2019re on the list.',
  tipMarketingLeadFormSuccessBody:
    'Watch your inbox \u2014 the next tip and upcoming training will land soon.',
  tipMarketingLeadFormError: 'Something went wrong. Please try again.',
  tipMarketingLeadFormInvalidEmail: 'Please enter a valid email address.',
  tipMarketingLeadFormRequired: 'Name and email are required.',
  tipMarketingLeadFormConsent:
    'By subscribing you agree to receive food-safety updates from HACCP PRO.',
  tipMarketingStickyTitle: 'Join the next live training',
  tipMarketingStickyOnDate: 'on',
  tipMarketingQrTitle: 'Scan to read this tip',
  tipMarketingQrSubtitle: 'Print and post in your kitchen so the team can scan it on shift.',
  tipMarketingDefaultCtaHeadline: 'Train your team on this',
  tipMarketingDefaultCtaButton: 'Reserve your seat',
  tipMarketingTrainerLabel: 'Trainer',
  tipMarketingPrintLabel: 'Print',

  tipsBodyHeading: 'Detailed Protocol Implementation',
  tipsAuditorNoteTitle: 'Expert Auditor Note',
  tipsSidebarPromoEyebrow: 'Master food safety with',
  tipsSidebarPromoTitle: 'Certification',
  tipsSidebarPromoBody:
    'Join our elite training program used by 12,000+ professionals worldwide. Get FSSAI and HACCP certified in just 48 hours.',
  tipsSidebarPromoButton: 'View All Modules',
  tipsSidebarCategoriesTitle: 'Protocol Categories',
  tipsSidebarSubscribeTitle: 'Weekly Updates',
  tipsSidebarSubscribeBody:
    'Get safety protocols delivered straight to your inbox.',
  tipsSidebarSubscribeButton: 'Subscribe',
  tipsSidebarSubscribeEmailPlaceholder: 'name@company.com',
  tipsNextTipLabel: 'Next Tip',
};

const HI: LandingStrings = {
  navHome: 'होम',
  navTraining: 'ट्रेनिंग',
  navTips: 'रोज़ की सलाह',
  navNews: 'खाद्य सुरक्षा समाचार',
  navJobs: 'नौकरियाँ',
  navCourses: 'ट्रेनिंग कोर्स',
  signIn: 'साइन इन',
  whatsapp: 'WhatsApp',
  openMenu: 'मेन्यू खोलें',
  closeMenu: 'मेन्यू बंद करें',
  menu: 'मेन्यू',
  haccpProHome: 'HACCP PRO होम',
  language: 'भाषा',
  brandTagline: 'खाद्य सुरक्षा इंटेलिजेंस',

  heroEyebrow: 'खाद्य सुरक्षा इंटेलिजेंस',
  heroTitleA: '',
  heroTitleHighlight: 'खाद्य सुरक्षा',
  heroTitleB: ' की ऐसी संस्कृति बनाएं जो आपके ऑडिटर्स को भी पसंद आए।',
  heroSubtitle:
    'HACCP PRO आपकी रोज़मर्रा की रसोई दिनचर्या को ऑडिट-तैयार रिकॉर्ड में बदलता है। एक ही जुड़े हुए प्लेटफ़ॉर्म पर अपनी टीम को ट्रेनिंग दें, अनुपालन की रीयल-टाइम निगरानी करें और हर नियामक बदलाव से आगे रहें।',
  browseCourses: 'कोर्स देखें',

  trustValueLearners: '10 हज़ार+',
  trustLabelLearners: 'प्रशिक्षित शिक्षार्थी',
  trustValueCurriculum: 'ISO 22000',
  trustLabelCurriculum: 'संरेखित पाठ्यक्रम',
  trustValueAuditPass: '99.9%',
  trustLabelAuditPass: 'ऑडिट पास दर',

  trainingEyebrow: 'लाइव ट्रेनिंग कैलेंडर',
  trainingTitle: 'आगामी लाइव ट्रेनिंग सत्र',
  trainingSubtitle:
    'हमारी अगली प्रशिक्षक-नेतृत्व वाली ट्रेनिंग में अपनी सीट बुक करें। सभी सत्र प्रमाणित खाद्य-सुरक्षा ऑडिटर्स द्वारा संचालित होते हैं और डिजिटल उपस्थिति प्रमाणपत्र के साथ आते हैं।',
  loadingSessions: 'सत्र लोड हो रहे हैं…',
  noTrainingsTitle: 'कोई लाइव ट्रेनिंग निर्धारित नहीं है',
  noTrainingsBody:
    'हम अगले बैच के सत्र तैयार कर रहे हैं। जल्द फिर से देखें या सूचना पाने के लिए साइन इन करें।',
  cardTrainerLabel: 'प्रशिक्षक',
  cardRegister: 'पंजीकरण करें',

  tipsEyebrow: 'रोज़ की खाद्य सुरक्षा सलाह',
  tipsTitle: 'सुरक्षित रसोई के लिए छोटी-छोटी सलाह',
  tipsSubtitle:
    'त्वरित, व्यावहारिक सुझाव जिन्हें आपकी टीम शिफ्ट के दौरान लागू कर सकती है — छोटे प्रोटोकॉल, स्वच्छता रिमाइंडर और बेहतरीन तरीके, सब एक जगह।',
  loadingTips: 'सलाह लोड हो रही हैं…',
  noTipsTitle: 'अभी तक कोई सलाह प्रकाशित नहीं हुई',
  noTipsBody: 'हमारी कंटेंट टीम पहला बैच तैयार कर रही है — कल फिर से देखें।',
  tipOfTheDay: 'आज की सलाह',
  untitledTip: 'शीर्षक रहित सलाह',

  newsEyebrow: 'लाइव इंटेलिजेंस फ़ीड',
  newsTitle: 'बदलाव से एक कदम आगे रहें',
  newsSubtitle:
    'FSSAI, HACCP, ISO 22000 और वैश्विक खाद्य-सुरक्षा रुझानों पर चुनिंदा अपडेट — प्लांट प्रबंधकों और QA लीड्स के लिए।',
  newsRegulatoryTitle: 'नियामक अपडेट',
  newsIndustryTitle: 'उद्योग रुझान',
  newsRegulatoryEmpty: 'अभी कोई नियामक अपडेट नहीं',
  newsIndustryEmpty: 'अभी कोई उद्योग रुझान नहीं',
  newsIndustryEmptyNoKeywords: 'अभी कोई कीवर्ड कॉन्फ़िगर नहीं किया गया',
  newsNewPill: 'नया',
  newsViewAll: 'सभी देखें',
  newsViewAllAria: 'सभी समाचार देखें',
  loadingNews: 'लेख लोड हो रहे हैं…',
  noNewsTitle: 'अभी तक कोई समाचार नहीं',
  noNewsBody: 'हमारे संपादक प्रकाशित करते ही पहली कहानियाँ यहाँ दिखेंगी।',
  untitledArticle: 'शीर्षक रहित लेख',
  cardMinRead: 'मिनट में पढ़ें',
  cardRead: 'पढ़ें',

  latestNewsHeroTitlePrefix: 'वैश्विक खाद्य सुरक्षा',
  latestNewsHeroTitleHighlight: 'इंटेलिजेंस',
  latestNewsHeroSubtitle:
    'अधिकृत नियामक अपडेट और चुनिंदा उद्योग समाचार — ताकि आपका व्यवसाय हमेशा अनुपालित रहे।',
  latestNewsSearchPlaceholder: 'समाचार, अपडेट, नियामक खोजें…',
  latestNewsRegulatoryTitle: 'नियामक एवं अनुपालन अपडेट',
  latestNewsIndustryTitle: 'उद्योग रुझान एवं सामान्य समाचार',
  latestNewsRegulatoryEmptyTitle: 'कोई मेल खाता नियामक अपडेट नहीं',
  latestNewsIndustryEmptyTitle: 'कोई मेल खाता उद्योग समाचार नहीं',
  latestNewsIndustryEmptyNoKeywordsTitle: 'अभी कोई कीवर्ड कॉन्फ़िगर नहीं किया गया',
  latestNewsIndustryEmptyNoKeywordsBody:
    'उद्योग की हेडलाइनें यहाँ दिखाने के लिए एडमिन को अकैडमी एडमिन पैनल में कम-से-कम एक Google News कीवर्ड जोड़ना होगा।',
  latestNewsEmptyBody: 'खोज साफ़ करके या कोई दूसरी श्रेणी चुनकर देखें।',
  latestNewsChipAll: 'सभी',
  latestNewsUpdatesCount: (n: number) => `${n} ${n === 1 ? 'अपडेट' : 'अपडेट'}`,
  latestNewsOfficialGazette: 'आधिकारिक गज़ट',
  latestNewsGoogleNews: 'Google News',
  latestNewsCtaPill: 'HACCP PRO अकादमी',
  latestNewsCtaTitle: 'सिर्फ़ समाचार न पढ़ें। मानक तय करें।',
  latestNewsCtaSubtitle:
    'हर नियामक अपडेट को कार्रवाई में बदलें। अपनी टीम को प्रमाणित खाद्य-सुरक्षा कोर्सों में नामांकित करें और हर ऑडिट से एक कदम आगे रहें।',
  latestNewsCtaButton: 'अकादमी देखें',
  latestNewsFeaturedPill: 'प्रमुख',
  latestNewsLoadMore: 'और देखें',
  latestNewsLoadingMore: 'और लोड हो रहा है…',
  latestNewsShowingCount: (shown: number, total: number) =>
    `${total} में से ${shown} दिखाए जा रहे हैं`,
  latestNewsShare: 'लेख शेयर करें',
  latestNewsShareCopied: 'लिंक कॉपी हो गया',

  coursesEyebrow: 'ट्रेनिंग कोर्स',
  coursesTitle: 'ऑन-डिमांड कोर्स कैटलॉग',
  coursesSubtitle:
    'HACCP, खाद्य स्वच्छता, एलर्जन प्रबंधन और बहुत कुछ पर स्व-गति प्रमाणन। ब्राउज़ करें, नामांकन करें और कुछ ही मिनटों में शुरू करें।',
  searchCourses: 'कोर्स खोजें…',
  allLevels: 'सभी स्तर',
  loadingCourses: 'कोर्स लोड हो रहे हैं…',
  noCoursesTitle: 'कोई सक्रिय कोर्स नहीं मिला',
  noCoursesBody: 'कोई दूसरा शब्द आज़माएँ या जल्द लौटें — हम हर महीने नया कंटेंट प्रकाशित करते हैं।',
  cardLessonsLabel: 'पाठ',
  cardStudentsLabel: 'विद्यार्थी',
  untitledCourse: 'शीर्षक रहित कोर्स',
  free: 'मुफ़्त',

  whyEyebrow: 'HACCP PRO क्यों',
  whyTitle: 'पूरे अनुपालन जीवनचक्र के लिए एक प्लेटफ़ॉर्म',
  whySubtitle:
    'रसोई की लाइन से बोर्डरूम तक — HACCP PRO ट्रेनिंग, ऑडिट और रिकॉर्ड को एक ही प्रमाणपत्र-तैयार ट्रेल में जोड़ता है।',
  featSmartAuditsTitle: 'स्मार्ट ऑडिट',
  featSmartAuditsBody:
    'मोबाइल-फ़र्स्ट ऑडिट चेकलिस्ट जिनमें फ़ोटो साक्ष्य, स्कोरिंग और तुरंत रिपोर्ट हैं — आपके ऑडिटर सेकंडों में साइन कर सकते हैं।',
  featTrainingTitle: 'ट्रेनिंग और LMS',
  featTrainingBody: 'कोर्स असाइन करें, पूर्णता ट्रैक करें और स्प्रेडशीट के झंझट के बिना प्रमाणपत्र दें।',
  featRecordsTitle: 'रिकॉर्ड और ट्रेसेबिलिटी',
  featRecordsBody:
    'HACCP रिकॉर्ड, तापमान लॉग और सप्लायर दस्तावेज़ — एक ही खोजने योग्य, ऑडिट-तैयार वॉल्ट में।',
  featRealtimeTitle: 'रीयल-टाइम अनुपालन',
  featRealtimeBody:
    'लाइव डैशबोर्ड नियामक से पहले ही देरी से चल रहे कार्यों, समाप्त हो रहे लाइसेंसों और जोखिम वाले यूनिट्स को चिह्नित करते हैं।',

  ctaPill: '14-दिन का मुफ़्त ट्रायल',
  ctaTitle: 'अपने अगले ऑडिट को बिना झंझट का बनाने के लिए तैयार हैं?',
  ctaSubtitle:
    'अपने HACCP PRO वर्कस्पेस में साइन इन करें या अपनी रसोई, यूनिट्स या सप्लाई चेन में इसे लागू करने के बारे में हमारी टीम से बात करें।',
  talkToUs: 'हमसे बात करें',

  footerTagline:
    'HACCP PRO खाद्य व्यवसायों को ट्रेनिंग, डिजिटल रिकॉर्ड और रीयल-टाइम अनुपालन निगरानी के साथ ऑडिट-तैयार रखने में मदद करता है।',
  footerQuickLinks: 'त्वरित लिंक',
  footerContact: 'संपर्क',
  footerLegal: 'क़ानूनी',
  footerPrivacy: 'गोपनीयता नीति',
  footerTerms: 'सेवा की शर्तें',
  footerSecurity: 'सुरक्षा ऑडिट',
  footerFollow: 'फ़ॉलो करें',
  footerCopyright: (year) => `© ${year} HACCP PRO ग्लोबल सिस्टम्स`,
  footerTrustedBy: 'दुनिया भर के खाद्य व्यवसायों का भरोसा',
  footerWhatsapp: 'WhatsApp',

  illustComplianceDashboard: 'अनुपालन डैशबोर्ड',
  illustAuditsPassed: 'पास किए गए ऑडिट',
  illustActiveLearners: 'सक्रिय शिक्षार्थी',
  illustOpenTasks: 'खुले कार्य',
  illustCertificates: 'प्रमाणपत्र',
  illustTodaysFocus: 'आज का फ़ोकस',
  illustTodaysFocusBody: '6 यूनिट्स पर कोल्ड-चेन तापमान जाँच शाम 4 बजे से पहले बाकी है।',

  newsBackToNews: 'समाचार पर वापस',
  newsLoading: 'लेख लोड हो रहा है…',
  newsNotFoundTitle: 'क्षमा करें, यह लेख अब उपलब्ध नहीं है।',
  newsNotFoundBody: 'इसे अप्रकाशित या हटा दिया गया हो सकता है।',
  newsReturnHome: 'होम पर लौटें',
  newsBy: 'द्वारा',
  newsCoverAlt: 'समाचार कवर',
  untitledTraining: 'शीर्षक रहित ट्रेनिंग',

  tipsBackToTips: 'सलाह पर वापस',
  tipsLoading: 'सलाह लोड हो रही है…',
  tipsNotFoundTitle: 'क्षमा करें, यह सलाह अब उपलब्ध नहीं है।',
  tipsNotFoundBody: 'इसे अप्रकाशित या हटा दिया गया हो सकता है।',
  tipReadFull: 'सलाह पढ़ें',

  shareLabel: 'साझा करें',
  shareCopied: 'लिंक कॉपी हो गया',

  tipMarketingRecommendedTrainingEyebrow: 'अनुशंसित ट्रेनिंग',
  tipMarketingRecommendedTrainingTitle: 'इस सलाह को टीम-व्यापी अभ्यास में बदलें',
  tipMarketingRecommendedTrainingFallbackTitle: 'आगामी लाइव ट्रेनिंग सत्र',
  tipMarketingTakeFullCourseEyebrow: 'स्व-गति कोर्स',
  tipMarketingTakeFullCourseTitle: 'पूरा कोर्स करें',
  tipMarketingExploreCourse: 'कोर्स देखें',
  tipMarketingTrustEyebrow: 'अनुरूप मानक',
  tipMarketingTrustFssai: 'FSSAI दिशा-निर्देश',
  tipMarketingTrustHaccp: 'HACCP सिद्धांत',
  tipMarketingTrustIso: 'ISO 22000',
  tipMarketingLeadFormTitle: 'अगली खाद्य-सुरक्षा सलाह और ट्रेनिंग अपडेट पाएं',
  tipMarketingLeadFormSubtitle:
    'सप्ताह में एक छोटा ईमेल — एक नई सलाह और अगली लाइव ट्रेनिंग के साथ। कभी भी अनसब्सक्राइब करें।',
  tipMarketingLeadFormName: 'आपका नाम',
  tipMarketingLeadFormEmail: 'ईमेल पता',
  tipMarketingLeadFormPhone: 'फ़ोन (वैकल्पिक, WhatsApp)',
  tipMarketingLeadFormSubmit: 'सब्सक्राइब करें',
  tipMarketingLeadFormSubmitting: 'भेजा जा रहा है…',
  tipMarketingLeadFormSuccess: 'धन्यवाद! आप सूची में जुड़ गए हैं।',
  tipMarketingLeadFormSuccessBody:
    'अपना इनबॉक्स देखते रहें — अगली सलाह और आगामी ट्रेनिंग जल्द ही पहुँचेगी।',
  tipMarketingLeadFormError: 'कुछ ग़लत हो गया। कृपया फिर कोशिश करें।',
  tipMarketingLeadFormInvalidEmail: 'कृपया एक मान्य ईमेल पता दर्ज करें।',
  tipMarketingLeadFormRequired: 'नाम और ईमेल आवश्यक हैं।',
  tipMarketingLeadFormConsent:
    'सब्सक्राइब करके आप HACCP PRO से खाद्य-सुरक्षा अपडेट प्राप्त करने के लिए सहमत होते हैं।',
  tipMarketingStickyTitle: 'अगली लाइव ट्रेनिंग में शामिल हों',
  tipMarketingStickyOnDate: 'दिनांक',
  tipMarketingQrTitle: 'इस सलाह को पढ़ने के लिए स्कैन करें',
  tipMarketingQrSubtitle: 'इसे प्रिंट कर अपनी रसोई में लगाएँ ताकि टीम शिफ्ट के दौरान स्कैन कर सके।',
  tipMarketingDefaultCtaHeadline: 'अपनी टीम को इस पर ट्रेनिंग दें',
  tipMarketingDefaultCtaButton: 'अपनी सीट बुक करें',
  tipMarketingTrainerLabel: 'प्रशिक्षक',
  tipMarketingPrintLabel: 'प्रिंट करें',

  tipsBodyHeading: 'विस्तृत प्रोटोकॉल कार्यान्वयन',
  tipsAuditorNoteTitle: 'विशेषज्ञ ऑडिटर नोट',
  tipsSidebarPromoEyebrow: 'खाद्य सुरक्षा में महारत हासिल करें',
  tipsSidebarPromoTitle: 'प्रमाणन के साथ',
  tipsSidebarPromoBody:
    'दुनिया भर के 12,000+ प्रोफ़ेशनल जिस एलीट ट्रेनिंग प्रोग्राम का उपयोग करते हैं उससे जुड़ें। केवल 48 घंटों में FSSAI और HACCP प्रमाणित बनें।',
  tipsSidebarPromoButton: 'सभी मॉड्यूल देखें',
  tipsSidebarCategoriesTitle: 'प्रोटोकॉल श्रेणियाँ',
  tipsSidebarSubscribeTitle: 'साप्ताहिक अपडेट',
  tipsSidebarSubscribeBody:
    'सुरक्षा प्रोटोकॉल सीधे आपके इनबॉक्स में पाएँ।',
  tipsSidebarSubscribeButton: 'सब्सक्राइब करें',
  tipsSidebarSubscribeEmailPlaceholder: 'name@company.com',
  tipsNextTipLabel: 'अगली सलाह',
};

const STRINGS: Record<LandingLang, LandingStrings> = { en: EN, hi: HI };

export const useLandingT = (): {
  t: LandingStrings;
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
  locale: string;
} => {
  const [lang, setLang] = useLandingLanguage();
  const locale =
    LANDING_LANGUAGES.find((l) => l.code === lang)?.locale || 'en-IN';
  return { t: STRINGS[lang], lang, setLang, locale };
};

// ── Localised content helpers ─────────────────────────────────────────────
// Admin content (tips + news posts) stores Hindi variants under
// `translations.<lang>.<field>` so the canonical English row is
// untouched and unilingual rows continue to render unchanged.

export interface LocalisableContent {
  translations?: Partial<Record<LandingLang, Record<string, unknown>>> | null;
}

export const localizedField = <T extends LocalisableContent>(
  item: T | null | undefined,
  lang: LandingLang,
  field: keyof T & string,
): string => {
  if (!item) return '';
  const raw = (item as Record<string, unknown>)[field];
  const englishValue = typeof raw === 'string' ? raw : '';
  if (lang === 'en') return englishValue;
  const variant = item.translations?.[lang];
  const localised = variant ? variant[field] : undefined;
  if (typeof localised === 'string' && localised.trim()) return localised;
  return englishValue; // graceful fallback to English
};
