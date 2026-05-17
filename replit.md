# HACCP PRO - Food Safety Management System

## Overview
HACCP PRO is an enterprise-grade food safety management dashboard designed to automate and streamline food safety compliance for businesses. It provides a comprehensive suite of tools for managing operations, ensuring regulatory adherence, and enhancing efficiency across various food processes. Key capabilities include user authentication, compliance monitoring, hierarchical data organization, audit scheduling, stock management, and detailed record-keeping. The project aims to significantly improve food safety standards and operational effectiveness, delivering a robust solution for food safety management and operational excellence.

## User Preferences
I want iterative development. Ask before making major changes. I prefer detailed explanations for complex logic or significant architectural decisions. I prioritize clear, maintainable code.

## System Architecture
The application is built using Next.js 15 (App Router), TypeScript, React 19, and Tailwind CSS 3, featuring a responsive UI/UX design.

**Core Architectural Decisions & Features:**

*   **Responsive Design:** A 3-tier responsive layout with dynamic component rendering and unified pagination.
*   **Audit Management:** Comprehensive audit form builder with hierarchical structures, various response types, scoring, logic rules, and CSV import/export. Includes draft persistence, multi-stage review workflows, observation extraction, and multi-select bulk question manipulation. Supports PDF, department-wise Excel, and location-wise Excel exports, along with Excel audit data import and image/observation attachment. Audit data features offline-first persistence with debounced DB sync.
*   **Master Checklist Editor:** A spreadsheet-style editor supporting question management, bulk CSV upload, dynamic filtering, and integration with audit form creation.
*   **Raw Material Management:** Manages Ingredients and Food Contact Materials with analytics, brand onboarding, vendor assignment, and Excel export, leveraging scope-based data isolation. Ingredient cards display inline allergens and Veg/Non-Veg toggles with auto-save. CSV import for ingredients is immediate, with conflicts auto-patched.
*   **Brand Management:** Corporate-wide brand registry with scope-based visibility, brand adoption, smart duplicate detection (Jaro-Winkler fuzzy matching), dynamic merging, and bulk CSV import.
*   **Supplier Management:** Supplier registry with scope-based data isolation and bulk import.
*   **Recipe Calculation:** "Recipe Studio" with visual nutrition stats, advanced CSV import, and manual allergen tagging. Features multi-tenant data isolation, location-based filtering, orphan location detection with reassignment, and auto-fix on entity renames. Integrates external nutrition lookup from USDA and FSANZ, and includes auto-pre-fill for red-flagged ingredients.
*   **License Management:** Integrated into Dashboard as a dedicated sub-view for compliance monitoring and renewals.
*   **Facility Hygiene Tab:** Consolidates facility management modules including equipment lists, hygiene checklists, preventive maintenance, calibration, and pest management.
*   **Preventive Maintenance Module:** Full-featured PM module with scheduling, plan management, attend/verify/reschedule workflows, and PDF report generation.
*   **Record Management:** Dedicated modules for Receiving, Cooking, Reheating, and Thawing with detailed forms, signature pads, image uploads, corrective actions, and native jsPDF generation with QR code integration.
*   **SOP Management:** Hierarchy-aware master repository for Standard Operating Procedures with rich text editing, professional PDF/Word export, and scope-tagged visibility.
*   **Precision Resource Mapping:** Tree-based layout for unit management showing Department → Location → Sub-Location hierarchy with personnel assignment.
*   **Database-Backed Entity & User Management:** Entities (Corporate/Regional/Unit/Department), Users/Employees, and License Schemas persisted to PostgreSQL using JSONB storage patterns with debounced saves and batch upsert.
*   **Scope Impersonation (Act-As):** Allows upper hierarchy users to impersonate child nodes, adapting application behavior and data visibility.
*   **Supplier Pre-Arrival Submission Workflow:** Enables suppliers to pre-submit delivery details via a portal for unit review and approval, promoting approved submissions to Receiving Register entries.
*   **Employee Management:** Supports bulk delete, dynamic staff categories, and dynamic dropdowns for roles, departments, and categories inherited through the entity hierarchy.
*   **Food Safety Team:** Manages a dynamic Food Safety Team auto-populated from user lists, with manual addition of members and integration into audit schedules.
*   **Training Management (LMS):** Includes a Training Tracker, Trainer Management, Training Calendar with shareable links, Certificate Studio for template design, a complete Academy LMS Backend with API, an Admin Panel, a Student Portal, and a Content Editor for News and Tips with rich text editing and image handling. Features public reader pages for articles and tips with social sharing integration and Google Drive image normalization.
*   **Affiliate Marketing System:** Cross-module referral code and commission tracking system for LMS course enrollments and Training Calendar registrations, with an admin tab for management.
*   **Multi-Participant Training Registration:** Supports 1..N participants in one corporate booking via a single form, with API handling for batch processing and individual participant side-effects.
*   **Navigation Structure:** Dashboard features sub-navigation, and Record Keeping section is reordered.
*   **Email (SMTP/Nodemailer):** Transactional emails for registrations and payments with retry mechanisms and scheduling.
*   **WhatsApp Integration:** Shared `utils/whatsapp.ts` `openWhatsApp` helper hands off to WhatsApp Desktop via `whatsapp://` protocol with `web.whatsapp.com` fallback. Used in Training Calendar (per-participant icons) and Observation modal. After saving an observation, a confirm popup (`components/WhatsAppObservationConfirm.tsx`) prompts to send a WhatsApp message to the responsibility-mapped contact (recipient name+phone persisted per responsibility in `localStorage` via `utils/responsibilityContacts.ts`); the message template is editable; missing-number case shows a toast and skips silently.
*   **Mandatory Protocols/Mandates:** Protocols persisted to PostgreSQL, loaded on app startup, with auto-saving and corporate-tree scoped visibility.
*   **Deployment:** Utilizes a custom Node.js server to wrap Next.js for fast health checks in Autoscale environments.
*   **Document Specifications:** 3-level hierarchy with CRUD, file upload, expand/collapse, and bulk Excel import.
*   **Data Sync:** Version-based sync mechanism for upserting development data to production on startup using PostgreSQL advisory locks. Includes one-time audit observation sync.
*   **Public-Only Mirror Domain:** Optional secondary custom domain serves only the public landing experience (landing, /academy, /courses, /news, /tips, /jobs, /legal) with no login/signup/admin and no authenticated APIs. Driven by `PUBLIC_ONLY_HOSTS` env var (comma-separated host list, www-tolerant). Implementation: `lib/publicOnlyHosts.ts` classifier + `middleware.ts` allowlist enforcement (sets `x-haccp-public-only` header & cookie) + `utils/usePublicOnlyMirror.ts` client hook + `hideSignIn` plumbed through `AcademyPublicHome` and `PublicSiteShell`. Per-host `app/robots.ts`. Single codebase: superadmin edits landing content on the primary domain and changes appear on the mirror automatically.

## External Dependencies
*   **UI Libraries:** React 19, Tailwind CSS 3, Lucide React, Font Awesome
*   **Charting:** recharts
*   **PDF Generation:** jspdf
*   **Data Export/Import:** exceljs, xlsx
*   **Document Processing:** docx, mammoth
*   **Image Manipulation:** cropperjs
*   **QR Code Generation:** qrcode.react
*   **Artificial Intelligence:** @google/genai, Puter.js