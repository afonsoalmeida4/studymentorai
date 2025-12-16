# Study Mentor AI

## Overview
Study Mentor AI is a Notion-style knowledge organization platform designed to help users structure, process, and study academic materials with integrated AI support. It enables the creation of hierarchical knowledge structures (Subjects → Topics → Content Items), supports uploads of various document types (PDF, Word, PowerPoint), and allows for the addition of external links. Key features include personalized AI summaries with multiple learning styles, a dual-mode AI assistant for academic and existential support, Anki-style flashcards with SM-2 spaced repetition, gamification with XP and levels, and a tiered subscription model (Free, Pro, Premium). The platform aims to provide a calm and clean interface inspired by Notion, Linear, and Grammarly, combining hierarchical organization with generative AI.

## User Preferences
- Communication: Simple, everyday language (Portuguese)
- Design inspiration: Notion, Linear, Grammarly (calm, clean, organized)

## System Architecture

### Frontend Architecture
The frontend is built with React 18, TypeScript, Vite, Wouter for routing, and TanStack Query for server state management. UI components leverage Shadcn/ui, Radix UI primitives, and Tailwind CSS, adhering to a Notion-inspired clean design. State management uses TanStack Query for server state and React hooks for local UI state. Form validation is handled by React Hook Form and Zod. Internationalization is implemented using `react-i18next` supporting 6 languages (Portuguese, English, Spanish, French, German, Italian), with user language preferences synced across the application.

### Backend Architecture
The backend is an Express.js application written in TypeScript, using ESM modules. It provides a RESTful API for managing subjects, topics, content items, AI chat functionalities, flashcards, and subscriptions. Document processing extracts text from PDF, DOCX, and PPTX files for AI summarization. Security features include session-based authentication, user ID validation, parent resource ownership checks, Zod validation, and tenant isolation. OpenAI GPT-4 powers all AI functionalities (summaries, flashcards, chat).

### Data Storage
PostgreSQL (Neon) is the primary database, managed with Drizzle ORM. The schema includes tables for `subjects`, `topics`, `content_items` (supporting files and links), `summaries`, `flashcards`, `flashcard_translations`, `flashcard_reviews`, `flashcard_daily_metrics`, `chat_threads`, `chat_messages`, `users`, `subscriptions`, `usage_tracking`, `topicStudyTime`, `topicStudyEvents`, `tasks`, `topicProgress`, and `calendar_events`. Strict foreign key relationships and `ON DELETE CASCADE` ensure data integrity. All users are students by default. The `flashcard_translations` table supports multi-language SM-2 spaced repetition progress across different languages by mapping translated flashcards to a base Portuguese flashcard ID, ensuring shared progress tracking. The `calendar_events` table stores academic calendar events (exams and assignments) with optional associations to subjects/topics and completion tracking.

### Authentication & Authorization
Authentication uses Replit OIDC with session-based authentication via `express-session`. Authorization is granular, scoping all resources to `userId` and validating parent resource ownership throughout the hierarchy. All users are students by default with no role selection required.

**OAuth Loop Fix** (RESOLVED): Fixed infinite OAuth login loop on production/published app (Safari iOS).

**Root Cause**: Session cookies with `sameSite: "strict"` were being blocked by Safari on OAuth callback redirects:
1. User clicks login → redirects to `https://replit.com/oidc` (Replit OAuth)
2. User clicks "Allow" → OAuth redirects back to `https://your-app.replit.app/api/callback`
3. This is a **cross-site redirect** (replit.com → your-app.replit.app)
4. Safari iOS **blocks** cookies with `sameSite: "strict"` on cross-site redirects
5. `/api/callback` receives no session cookie → `req.login()` fails silently
6. User redirected back to `/api/login` → **INFINITE LOOP**

**Technical Analysis** (via architect tool):
- `sameSite: "strict"` prevents CSRF but also blocks legitimate OAuth callbacks
- Safari is more aggressive than Chrome in enforcing SameSite policies
- Session cookie must survive the round-trip: login → OAuth provider → callback

**Solution Implemented** (server/replitAuth.ts lines 39-56):
```typescript
cookie: {
  httpOnly: true,
  secure: true,
  sameSite: "lax", // CRITICAL: Must be "lax" for OAuth callbacks
  maxAge: sessionTtl,
}
```

**Why "lax" is Safe**:
- Still protects against CSRF on state-changing requests (POST, PUT, DELETE)
- Allows cookies on "safe" cross-site navigations (GET redirects from OAuth)
- Industry standard for OAuth flows
- Maintains security while enabling authentication

**Frontend Fix** (client/src/pages/landing.tsx):
- Removed conflicting useEffect that caused frontend redirect loops
- App.tsx is sole routing controller based on authentication state
- Login buttons check authentication before forcing OAuth redirect

**Testing**: Session cookies now persist through OAuth callback, authentication works on Safari iOS

### Key Features
- **Flashcard System**: Manual flashcard creation and management, integrated with the SM-2 spaced repetition system, supporting multi-language progress tracking. Includes CRUD operations and filtering. SM-2 scheduler includes guards against negative intervals (minimum 1 day).
- **Automatic Flashcard Translation**: All flashcards (manual and auto-generated) are automatically translated to all 6 supported languages using GPT-4 with educational-focused prompts. Translations are created at flashcard creation time and stored in the `flashcard_translations` table, enabling seamless language switching while preserving SM-2 progress across all languages.
- **Flashcard Migration Tool**: Admin endpoint `/api/admin/migrate-flashcards` for one-time migration of legacy flashcards without translations. Uses robust JSON validation and detailed error reporting. Note: Current implementation is functional for small batches but lacks retry/backoff, idempotency guards, and concurrency locks for production-scale migrations.
- **PDF Export**: Premium-only feature allowing export of AI-generated summaries to professionally formatted PDFs, including app branding and metadata. Protected by `requirePremium` middleware and rate limiting (10 requests per 15 minutes).
- **Internationalized Error Messages**: Backend returns structured error codes and parameters for client-side translation, providing dynamic and language-sensitive error messages.
- **Subscription Management**: Users can cancel subscriptions, immediately reverting to the free plan.
- **Topic Completion Tracking**: Users can mark topics as complete/incomplete via checkbox in subject view. Checkbox uses `Circle` icon (unchecked) and `CheckCircle2` icon (checked, green). Toggle mutation (`POST /api/topic-progress/:topicId/toggle`) updates progress and invalidates subject progress cache. UI uses `stopPropagation` to prevent topic navigation when clicking checkbox. Fully internationalized with tooltips (`subjectView.markComplete`, `subjectView.markIncomplete`).
- **Dashboard KPIs (Studley AI-Inspired Design)**: Enhanced dashboard with 4 key performance indicators (Study Time, Subject Progress, Tasks Completed, Study Streak) featuring Studley AI-inspired visual design:
  - **Gradient Card Backgrounds**: Each KPI card has a subtle gradient overlay (from-{color}-500/10 to-{color}-500/5)
  - **Animated Gradient Accent Bars**: Positioned absolute left-side w-1 gradient bars with rounded-l-md (replaces border-l-4 to respect rounded corners)
  - **Icon Containers**: Icons wrapped in p-1.5 rounded-lg containers with gradient backgrounds
  - **Framer Motion Animations**: Staggered fade-in/slide-up animations (0.1s delay increments), spring animations on values, animated progress bars
  - **Color Scheme**: Blue (study time), Emerald (subject progress), Violet (tasks), Orange (streak)
  - Tasks KPI hidden when user has 0 tasks. Subject Progress calculates completion from topic data.
  - **Mobile-optimized**: Compact headers with `h-4 w-4 sm:h-5 sm:w-5` icons, `min-w-0` + `truncate` on titles
- **Reusable KPICard Component**: `client/src/components/KPICard.tsx` provides consistent styling with gradient backgrounds, animations, circular progress indicators, and delta indicators for reuse across the application.
- **Mobile Responsiveness (iPhone 16 Pro)**: All components optimized for 393×852px viewport. Pattern: base styles target mobile (<640px), desktop uses `sm:` prefix. Button pattern: icon-only on mobile with `<span className="hidden sm:inline">{text}</span>` for labels. TopicView summary cards and SummaryStudySection use `flex flex-wrap` with icon-only buttons below `sm` breakpoint. No global `overflow-x: hidden` rules—all layout fixes are root-cause based.
- **Flashcard Statistics (Anki-style KPIs)**: Comprehensive study tracking with GitHub-style activity heatmap calendar, daily averages, days learned percentage, longest and current streaks. Statistics are stored in the `flashcard_daily_metrics` table for efficient aggregation. The `/api/flashcard-stats` endpoint returns heatmap data (365 days), streak calculations, and daily averages. The `StudyHeatmap` component displays activity intensity with color-coded cells and interactive tooltips. Fully internationalized in all 6 languages.
- **Academic Calendar**: Premium-only feature for organizing exams and assignments. Supports monthly and list views, event filtering (upcoming/past/completed/by-type), mandatory subject association (enforced at database level with NOT NULL constraint), optional topic association, completion tracking, responsive UI with overflow handling for calendar dialogs, and full internationalization. All calendar data automatically displays in the user's current language. Frontend includes defensive logic to handle edge cases with legacy events. Protected by `requirePremium` middleware.
- **Smart Quizzes (AI-Powered)**: Premium-only feature for testing knowledge with AI-generated multiple-choice quizzes. Features include:
  - **Quiz Generation**: AI generates 5-20 questions from topic summaries with adjustable difficulty (easy/medium/hard)
  - **Bilingual AI Explanations**: Each question includes detailed AI explanations in the user's current language
  - **Progress Tracking**: Quiz navigation with answered question indicators, progress bar, and time tracking
  - **Results Dashboard**: Score percentage, correct/incorrect counts, and detailed review with explanations
  - **Regeneration**: Users can regenerate new quizzes to practice different content
  - Database tables: `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_question_answers`
  - API endpoints: `/api/quizzes/generate`, `/api/quizzes/:quizId/submit`, `/api/quizzes/:quizId/regenerate`
  - Frontend component: `QuizSection.tsx` integrated into topic-view.tsx
  - Fully internationalized in all 6 languages (PT, EN, ES, FR, DE, IT)
- **Dual-Mode Chat**: Study mode available to all users (FREE, Pro, Premium). Existential mode requires Pro+ subscription. Frontend uses `safeActiveMode` derived from user plan to ensure FREE users always use study mode, with automatic cleanup of existential thread selection. Chat threads support editable titles via PATCH endpoint with frontend UI.
- **Security & Robustness**: OpenAI clients configured with 60-second timeout and 2 retries for resilience. Premium endpoints (`/api/calendar/*`, `/api/export/*`) protected by middleware. Export endpoints rate-limited to prevent abuse.
- **Performance Optimizations**: All flashcard translation operations use `Promise.all` for parallel execution across 5 target languages (instead of sequential processing). Topic flashcard aggregation endpoints parallelize `getOrCreateTranslatedFlashcards` calls across summaries. UI shows immediate toast feedback via `onMutate` callback when generating flashcards, before API completes.
- **Invisible Cost Controls** (`server/costControlService.ts`): Backend-only AI cost management that never exposes limits to users. Experience feels "unlimited" - only output depth varies by plan. Controls include:
  - **Input Size Control**: Silent text trimming (FREE: 15k chars, PRO: 50k chars, PREMIUM: 100k chars)
  - **Summary Depth Control**: Plan-based prompt depth modifiers (concise → structured → exam-ready)
  - **Chat Context Limiting**: Message history limits (FREE: 10 msgs, PRO: 30 msgs, PREMIUM: 50 msgs) and topic context limits
  - **File Size Control**: Silent file size limits (FREE: 10MB, PRO: 25MB, PREMIUM: 50MB) - never blocks, processes partially
  - **Frequency Protection**: Soft daily limits with silent delays (never blocks, adds 1-3s delays for abuse)
  - **Token Optimization**: Plan-based max completion tokens for all AI operations
  - All controls are invisible - no error messages about limits, tokens, or quotas are ever shown to users

## External Dependencies
- **AI Services:** OpenAI API (GPT-4) for summarization, flashcard generation, and dual-mode chat.
- **Database:** Neon Serverless PostgreSQL.
- **Payments:** Stripe for subscription billing.
- **Document Processing:** `pdf-parse` for PDFs, `mammoth` for DOCX, and `officeparser` for PPTX.
- **Build & Development:** TypeScript compiler, ESBuild, PostCSS, Tailwind CSS, `tsx`.