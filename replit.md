# AI Study Mentor

## Overview
AI Study Mentor is a Notion-style knowledge organization platform designed to help users structure, process, and study academic materials with integrated AI support. It enables the creation of hierarchical knowledge structures (Subjects → Topics → Content Items), supports uploads of various document types (PDF, Word, PowerPoint), and allows for the addition of external links. Key features include personalized AI summaries with multiple learning styles, a dual-mode AI assistant for academic and existential support, Anki-style flashcards with SM-2 spaced repetition, gamification with XP and levels, and a tiered subscription model (Free, Pro at 5.99€/month or 49.99€/year, Premium at 11.99€/month or 99.99€/year with ~27% yearly savings). The platform aims to provide a calm and clean interface inspired by Notion, Linear, and Grammarly, combining hierarchical organization with generative AI.

## User Preferences
- Communication: Simple, everyday language (Portuguese)
- Design inspiration: Notion, Linear, Grammarly (calm, clean, organized)

## Recent Changes

### November 20, 2025
- **File Upload Fixes & FREE Plan Learning Styles**: Fixed critical bugs in file upload and learning style selection
  - **PDF Upload Error**: Fixed `pdfParse is not a function` error by correcting pdf-parse module import with fallback (pdfParseModule.default || pdfParseModule)
  - **File Size Limits by Plan**: Implemented plan-based file size limits with dynamic validation
    - FREE: 10MB maximum per file
    - Pro/Premium: 100MB maximum per file
    - Multer middleware updated to allow 100MB uploads (was 50MB)
    - Custom validation in `isValidFileSize(size, plan)` enforces plan-specific limits
    - Error messages now show plan-specific limits dynamically
  - **Learning Styles Filter**: Fixed hardcoded learning styles array to respect plan limits
    - FREE users now see "Conciso" and "Visual" available for summary generation
    - Pro/Premium users see all 4 learning styles (Visual, Auditivo, Lógico, Conciso)
    - Fixed in both: initial summary generation UI and "Generate More Styles" dialog
    - Uses `getMissingStyles()` which filters by `limits.allowedLearningStyles`
    - Includes fallback UI when user has only non-allowed summaries (e.g., after downgrade)
  - Files affected: `server/textExtractor.ts`, `server/organizationRoutes.ts`, `client/src/pages/topic-view.tsx`
- **Subscription Pricing Updated**: Final subscription prices across all platforms
  - Pro: 5.99€/month or 49.99€/year (~27% yearly savings)
  - Premium: 11.99€/month or 99.99€/year (~27% yearly savings)
  - Added monthly/yearly billing toggle on subscription page
  - Backend accepts `billingPeriod` parameter for Stripe checkout
  - Translations updated in all 6 languages (PT, EN, ES, FR, DE, IT)
  - Removed "educational" plan from all translations
- **Class Management System Removed**: Completely removed teacher/student class management functionality to simplify the platform
  - Removed database tables: `classes`, `classEnrollments`, `classInvites`
  - Removed `role` column from `users` table (all users are now students by default)
  - Removed "teacher" role from system and role selection flow
  - Removed "educational" subscription plan
  - Deleted backend: `server/classService.ts`, all `/api/classes/*` endpoints, `/api/user/role` endpoint
  - Deleted frontend pages: `role-selection.tsx`, `my-classes.tsx`, `student-classes.tsx`
  - Removed class navigation links from sidebar
  - Database synchronized with `db:push --force` (executed twice)
- **Database Constraint Fix**: Fixed summary generation error by ensuring `language` field is included in both INSERT values and onConflict target to match the UNIQUE(topic_id, learning_style, language) constraint
- **Summary Regeneration Feature**: Implemented "Regenerate" button on each summary card with AlertDialog confirmation, allowing users to regenerate summaries in the same learning style
  - Buttons only appear when summary exists (conditional rendering)
  - Dialog state managed via onSettled handler (prevents stuck dialog on error)
  - Full i18n support: translations added in all 6 languages (PT, EN, ES, FR, DE, IT)
  - Toast notifications for success/error feedback
- **FREE Plan Restrictions Completed**: Implemented comprehensive access control to block FREE users from premium features
  - **Sidebar Navigation**: Dashboard, Chat, and Ranking links completely hidden for FREE users
  - **Page-Level Guards**: All premium pages (Dashboard, Chat, Ranking) redirect FREE users to /subscription
  - **Query Guards**: All premium API queries use `enabled: currentPlan !== "free"` to prevent execution before redirect
  - **Mutation Guards**: All premium mutations check `canUsePremiumFeatures = currentPlan !== "free"` and show upgrade dialog
  - **Subscription Resolution**: Robust handling of null/undefined subscriptions with `currentPlan = subscription?.plan || "free"` default
  - **Race Condition Prevention**: No premium API calls execute during loading or for FREE users at any time
  - **TypeScript Safety**: All guards use `currentPlan` instead of `subscription.plan` to prevent undefined errors
  - Files affected: `client/src/components/AppSidebar.tsx`, `client/src/pages/dashboard.tsx`, `client/src/pages/chat-view.tsx`
- **French Translation Fix**: Corrected hardcoded Portuguese strings appearing in French language mode
  - **New translation keys added** to all 6 languages (PT, EN, ES, FR, DE, IT):
    - `summaries.generatingSummary`: Loading state for single summary generation
    - `summaries.generatingWait`: Wait time message during generation
    - `summaries.loading`: Loading state for summaries list
  - **Hardcoded strings replaced** in `client/src/pages/topic-view.tsx`:
    - "A gerar resumo..." → `{t('summaries.generatingSummary')}`
    - "Isto pode demorar 1-2 minutos." → `{t('summaries.generatingWait')}`
    - "A carregar resumos..." → `{t('summaries.loading')}`
  - **i18n interpolation fixed**: Changed from string concatenation to proper placeholder usage
    - Before: `${count} ${t('...successMultiple')}`
    - After: `t('...successMultiple', { count })` with `{{count}}` placeholder in translations
  - Files affected: All 6 translation files, `client/src/pages/topic-view.tsx`
- **FREE Plan Card Information Updated**: Corrected subscription page to display accurate FREE plan features
  - **Updated features across all 6 languages** (PT, EN, ES, FR, DE, IT):
    - ❌ REMOVED: "3 uploads por mês" → ✅ CORRECTED: "4 uploads por mês"
    - ❌ REMOVED: "Assistente IA (Modo Estudo)" (FREE has no chat access)
    - ❌ REMOVED: "Limite de 10 mensagens/dia" (FREE has 0 chat messages)
    - ❌ REMOVED: "1 workspace"
    - ✅ ADDED: "Até 5 disciplinas/subjects/matières/asignaturas/Fächer/materie"
    - ✅ ADDED: "Até 10 tópicos/topics/sujets/temas/Themen/argomenti"
    - ✅ ADDED: "2 estilos de aprendizagem" (conciso + visual)
    - ✅ ADDED: "Ficheiros até 10MB/Files up to 10MB/Fichiers jusqu'à 10Mo"
    - ✅ KEPT: "Resumos até 1.000 palavras" and "Flashcards básicos"
  - **subscription.tsx featureKeys updated**: Changed from `["uploads", "summaries", "flashcards", "assistant", "chatLimit", "workspace"]` to `["uploads", "subjects", "topics", "summaries", "learningStyles", "flashcards", "fileSize"]`
  - All features now match actual FREE plan limits from `shared/schema.ts`
  - Files affected: All 6 translation files, `client/src/pages/subscription.tsx`
- **PRO Plan Card Information Updated**: Enhanced subscription page with detailed and descriptive PRO plan features
  - **subscription.tsx featureKeys updated**: Changed from `["uploads", "summaries", "flashcards", "assistant", "chat", "workspaces", "dashboard", "backup"]` to `["uploads", "subjects", "topics", "summaries", "learningStyles", "flashcards", "dashboard", "ranking", "sync"]`
  - **Updated features across all 6 languages** (PT, EN, ES, FR, DE, IT) with more descriptive copy:
    - ✅ **uploads**: "Uploads ilimitados de PDF, Word, PPT e links" (more detailed)
    - ✅ **subjects**: "Pastas ilimitadas" (renamed from "Disciplinas" for clarity)
    - ✅ **topics**: "Subpastas ilimitadas" (renamed from "Tópicos" for clarity)
    - ✅ **summaries**: "Resumos avançados ilimitados" (more descriptive)
    - ✅ **learningStyles**: "Estilo personalizado de aprendizagem" (benefit-focused)
    - ✅ **flashcards**: "Flashcards inteligentes com repetição espaçada" (detailed explanation)
    - ✅ **dashboard**: "Dashboard simples de progresso"
    - ✅ **ranking**: "Ranking de XP"
    - ✅ **sync**: "Sincronização entre dispositivos" (NEW feature)
  - PRO plan now displays 9 comprehensive features that clearly communicate value proposition
  - Files affected: All 6 translation files, `client/src/pages/subscription.tsx`

## System Architecture

### Frontend Architecture
The frontend is built with React 18, TypeScript, Vite, Wouter for routing, and TanStack Query for server state management. UI components leverage Shadcn/ui, Radix UI primitives, and Tailwind CSS, adhering to a Notion-inspired clean design. State management uses TanStack Query for server state and React hooks for local UI state. Form validation is handled by React Hook Form and Zod. Internationalization is implemented using `react-i18next` supporting 6 languages (Portuguese, English, Spanish, French, German, Italian), with user language preferences synced across the application.

### Backend Architecture
The backend is an Express.js application written in TypeScript, using ESM modules. It provides a RESTful API for managing subjects, topics, content items, AI chat functionalities, flashcards, and subscriptions. Document processing extracts text from PDF, DOCX, and PPTX files for AI summarization. Security features include session-based authentication, user ID validation, parent resource ownership checks, Zod validation, and tenant isolation. OpenAI GPT-4 powers all AI functionalities (summaries, flashcards, chat).

### Data Storage
PostgreSQL (Neon) is the primary database, managed with Drizzle ORM. The schema includes tables for `subjects`, `topics`, `content_items` (supporting files and links), `summaries`, `flashcards`, `flashcard_translations`, `flashcard_reviews`, `chat_threads`, `chat_messages`, `users`, `subscriptions`, and `usage_tracking`. Strict foreign key relationships and `ON DELETE CASCADE` ensure data integrity. All users are students by default. The `flashcard_translations` table supports multi-language SM-2 spaced repetition progress across different languages by mapping translated flashcards to a base Portuguese flashcard ID, ensuring shared progress tracking.

### Authentication & Authorization
Authentication uses Replit OIDC with session-based authentication via `express-session`. Authorization is granular, scoping all resources to `userId` and validating parent resource ownership throughout the hierarchy. All users are students by default with no role selection required.

## External Dependencies
- **AI Services:** OpenAI API (GPT-4) for summarization, flashcard generation, and dual-mode chat.
- **Database:** Neon Serverless PostgreSQL.
- **Payments:** Stripe for subscription billing.
- **Document Processing:** `pdf-parse` for PDFs, `mammoth` for DOCX, and `officeparser` for PPTX.
- **Build & Development:** TypeScript compiler, ESBuild, PostCSS, Tailwind CSS, `tsx`.