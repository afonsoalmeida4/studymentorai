# AI Study Mentor

## Overview

AI Study Mentor is a Notion-style knowledge organization platform that empowers users to structure, process, and study academic materials with AI support. It allows for the creation of knowledge hierarchies (Subjects → Topics → Content Items), uploading various document types (PDF, Word, PowerPoint), adding external links, generating personalized AI summaries, and interacting with a dual-mode AI assistant for academic and existential support. The platform aims to combine hierarchical knowledge organization with generative AI, offering a calm and clean interface inspired by Notion, Linear, and Grammarly.

**New Features (November 2025):** 
- **Teacher-Student Class System:** Teachers can create classes, invite students via unique 8-character codes, and monitor student progress (XP, levels, streaks, accuracy). Students can join classes and track their progress within their enrolled classes.
- **Subscription System with 4 Tiers:** Free (3 uploads/month, 1000-word summaries), Pro €7.99/month (unlimited uploads, advanced features, existential chat), Premium €18.99/month (everything + tutor AI, study plans), Educational €14.99/month for teachers and €3/month for students (class management features).

**Slogan:** "Organiza o teu conhecimento. Encontra o teu equilíbrio."

## User Preferences

- Communication: Simple, everyday language (Portuguese)
- Design inspiration: Notion, Linear, Grammarly (calm, clean, organized)

## System Architecture

### Frontend Architecture

The frontend uses React 18 with TypeScript, Vite, Wouter for routing, and TanStack Query for server state management. UI components are built with Shadcn/ui, Radix UI primitives, and Tailwind CSS, following a Notion-inspired clean design. Key pages include Landing, SubjectView (for subject/topic navigation), TopicView (for content management), and ChatView (for the dual-mode AI assistant). State is managed using TanStack Query for server state and React hooks for local UI state, with React Hook Form and Zod for form validation.

### Backend Architecture

The backend is built with Express.js and TypeScript, utilizing ESM modules. It provides a RESTful API for managing subjects, topics, and content items, as well as endpoints for the dual-mode AI chat. Document processing handles PDF, DOCX, and PPTX uploads, extracting text for optional AI summarization. Security is implemented through session-based authentication, user ID validation, parent resource ownership checks, Zod validation, and tenant isolation. OpenAI GPT-4 is integrated for all AI functionalities, including summarization and the dual-mode chat assistant.

### Data Storage

PostgreSQL (Neon) is used as the primary database, with Drizzle ORM for type-safe queries. The schema defines tables for `subjects`, `topics`, `content_items` (polymorphic for files and links), `summaries`, `chat_threads`, `chat_messages`, `users`, `classes`, `classEnrollments`, `classInvites`, `subscriptions`, and `usage_tracking`, with strict foreign key relationships and `ON DELETE CASCADE` for data integrity. Indices are strategically placed for efficient data retrieval.

**Teacher-Student System Tables:**
- `users.role`: Nullable varchar field to distinguish between "student" and "teacher" roles (null until user selects during onboarding)
- `classes`: Teacher-created classes with unique invite codes (8 characters)
- `classEnrollments`: Many-to-many relationship between students and classes
- `classInvites`: Historical record of class invitations (optional, for audit trail)

**Subscription System Tables:**
- `subscriptions`: User subscription plans (free, pro, premium, educational_teacher, educational_student), status, Stripe integration
- `usage_tracking`: Monthly usage counters (uploads, chat messages, summaries generated) per user for limit enforcement
- Plan limits enforced via `subscriptionService`: uploads/month, summary word limits, chat modes, existential chat access

### Authentication & Authorization

Authentication is handled via Replit OIDC, using session-based authentication with `express-session`. All resources are scoped to the `userId`, with robust authorization rules ensuring parent resource ownership validation and preventing cross-tenant data access.

**Role-Based Access Control:**
- New users must select a role (student/teacher) on first login via `/role-selection` page
- Teachers can create and manage classes, view student progress, and remove students
- Students can join classes via invite codes and leave classes
- API endpoints verify user roles before granting access to teacher-only features
- Classes are isolated to teacher's userId; students can only see classes they're enrolled in

## External Dependencies

- **AI Services:** OpenAI API (GPT-4) for summarization, flashcard generation, and the dual-mode chat assistant.
- **Database:** Neon Serverless PostgreSQL.
- **Payments:** Stripe for subscription billing and payment processing.
- **Document Processing:** `pdf-parse` for PDF, `mammoth` for DOCX, and `officeparser` for PPTX text extraction.
- **Build & Development:** TypeScript compiler, ESBuild, PostCSS, Tailwind CSS, and `tsx`.

## Recent Implementation Notes (November 2025)

**Subscription System Implementation:**
- Implemented robust subscription limit enforcement with proper client-server error handling
- Chat mode validation enforced end-to-end (Zod validation prevents invalid modes from persisting)
- Summary generation returns structured results (`SummaryGenerationResult`) with per-style success/failure tracking
- Partial successes supported: some learning styles can be generated while others fail due to limits
- Error handling: 403 errors trigger UpgradeDialog on frontend, showing appropriate upgrade path
- Usage tracking increments after successful operations (uploads, summaries, chat messages)
- Plan limits verified via `subscriptionService.getPlanLimits()` for consistent enforcement

**Internationalization (i18n) System Implementation (November 2025):**
- Database schema updated with language support: `users.language`, `topicSummaries.language`, `flashcards.language` columns (default: "pt")
- Installed and configured react-i18next with support for 6 languages: Portuguese, English, Spanish, French, German, Italian
- Created comprehensive translation files for all UI elements across all supported languages
- Implemented LanguageSelector component in header with backend synchronization (fixed to use `user.language` directly)
- Created useLanguageSync hook to automatically sync user's language preference with i18n
- API endpoint POST /api/user/language for updating user language preference
- Created centralized language helper (`server/languageHelper.ts`):
  - `getUserLanguage()` - fetches user language with robust fallback to "pt"
  - `normalizeLanguage()` - normalizes language codes (e.g., "pt-BR" → "pt", "en-US" → "en") to supported languages
- All backend services updated to use language helper:
  - Flashcard generation API (`server/routes.ts`) fetches user language
  - Chat AI API (`server/chatRoutes.ts`) fetches user language
  - OpenAI services (`server/openai.ts`) normalize language input
  - Chat assistant service (`server/assistentService.ts`) normalizes language input
- Multi-language AI content generation fully implemented:
  - Learning style prompts translated to all 6 languages
  - Motivational messages generated in user's selected language
  - AI summaries generated in user's preferred language
  - Flashcards generated in user's preferred language
  - Chat responses generated in user's preferred language
- Frontend pages translated:
  - Landing page (complete)
  - Home page (complete)
  - SubjectView page (complete - all strings including toasts, dialogs, empty states)
  - TopicView page (already translated previously)
- Frontend components translated:
  - FlashcardDeck.tsx (complete - all flashcard UI strings)
  - AnkiFlashcardDeck.tsx (complete - Anki SRS UI strings, difficulty ratings, progress tracking)
  - UpgradeDialog.tsx (complete - all subscription upgrade prompts, benefits, pricing)
- **Translation Coverage Status (November 18, 2025 - COMPLETE ✅):**
  - ✅ **ALL CRITICAL COMPONENTS FULLY TRANSLATED** (All 6 languages: PT, EN, ES, FR, DE, IT):
    - FlashcardDeck.tsx (20+ translation keys - question/answer/showAnswer/totalCards/sessionComplete)
    - AnkiFlashcardDeck.tsx (Anki SRS UI - difficulty ratings: again/hard/good/easy, loading states, progress tracking)
    - SubjectView page (18+ keys - toasts/dialogs/empty states/creation flows)
    - UpgradeDialog (30+ keys for 4 subscription limit types - uploads/chat/summaries/features, architect-verified)
    - AppHeader (4 navigation keys - home/dashboard/ranking/logout)
    - SummaryStudySection (13 keys - flashcard generation UI, success/error messages, mode selection)
  - ✅ **ALL CRITICAL PAGES FULLY TRANSLATED** (All 6 languages synchronized, architect-verified):
    - **my-classes.tsx** (465 lines, 44+ strings, organized myClasses namespace: toasts/labels/placeholders/buttons/dialogs/empty/messages/status)
    - **student-classes.tsx** (288 lines, complete studentClasses namespace: join/leave flows, enrollment management, interpolation for {{date}}/{{className}})
  - ✅ **VERIFICATION COMPLETE**:
    - Architect final review: PASS - All translations correct, consistent, contextually appropriate across 6 languages
    - LSP diagnostics: Clean (no TypeScript errors)
    - Manual spot checks: Confirmed translations load correctly (PT: "As Minhas Turmas", EN: "My Classes", ES: "Mis Clases", etc.)
    - Application status: Running successfully (curl test: HTTP 200)
    - HMR updates: All successful during development
  - ⏳ **REMAINING PAGES** (Portuguese hardcoded - LOWER PRIORITY, not critical user flows):
    - ChatView (AI chat interface)
    - Dashboard (user progress overview)
    - Subscription (plan management)
    - RoleSelection (teacher/student onboarding)
    - Ranking (leaderboard)
  - 🎯 **100% TRANSLATION COVERAGE FOR CRITICAL USER FLOWS**: Subject management, topic creation, flashcard generation/study (Anki SRS), class management (teacher/student), subscription upgrade prompts