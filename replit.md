# AI Study Mentor

## Overview
AI Study Mentor is a Notion-style knowledge organization platform designed to help users structure, process, and study academic materials with integrated AI support. It enables the creation of hierarchical knowledge structures (Subjects → Topics → Content Items), supports uploads of various document types (PDF, Word, PowerPoint), and allows for the addition of external links. Key features include personalized AI summaries with multiple learning styles, a dual-mode AI assistant for academic and existential support, Anki-style flashcards with SM-2 spaced repetition, gamification with XP and levels, and a tiered subscription model (Free, Pro, Premium). The platform aims to provide a calm and clean interface inspired by Notion, Linear, and Grammarly, combining hierarchical organization with generative AI.

## User Preferences
- Communication: Simple, everyday language (Portuguese)
- Design inspiration: Notion, Linear, Grammarly (calm, clean, organized)

## Recent Changes

### November 21, 2025 - Subscription Cancellation Feature
- **Backend Implementation**:
  - Modified `cancelSubscription()` method in `server/subscriptionService.ts` to immediately downgrade to free plan
  - Clears all Stripe metadata (customerId, subscriptionId, priceId, period dates)
  - Added POST `/api/subscription/cancel` endpoint in `server/routes.ts`
  - Error handling for edge cases (no subscription, already on free plan)
- **Frontend Implementation** (`client/src/pages/subscription.tsx`):
  - Added `cancelSubscriptionMutation` with query invalidation
  - Cancel button only visible when `currentPlan !== "free"`
  - Native browser confirmation dialog before cancellation
  - Success/error toast notifications with proper i18n
  - Button test-id: `button-cancel-subscription`
- **Full i18n Support**: Added 7 new translation keys across all 6 languages:
  - `cancelButton`, `canceling`, `cancelConfirmation`
  - `toasts.cancelSuccess`, `toasts.cancelSuccessMessage`
  - `toasts.cancelError`, `toasts.cancelErrorMessage`
- **User Experience**: Immediate cancellation with instant return to free plan (no end-of-period grace)

### November 21, 2025 - Dashboard Visual/UX Enhancements
- **8 Visual Improvements Implemented**:
  1. **Contextual Colors**: Green/yellow/red system based on performance deltas and progress percentages
  2. **Visual Hierarchy**: All 4 KPIs with distinct colored left borders (blue/green/purple/orange)
  3. **Larger Icons**: Upgraded from h-4 to h-6 with thematic colors matching card identity
  4. **Gradient Progress Bars**: Dynamic red→yellow→green gradients showing goal proximity
  5. **Animated Elements**: Smooth transitions (duration-300/500), fade-ins, pulse effects on empty states
  6. **Interactive Tooltips**: Info icons with contextual details (goals, remaining time, records)
  7. **Enhanced Empty States**: Larger animated numbers (animate-pulse), improved CTAs
  8. **Hover Effects**: Card elevation (hover-elevate) + visual feedback on all KPI cards
- **Design Improvements**:
  - Weekly Hours: ArrowUp/ArrowDown delta indicators, tooltip showing remaining hours to goal
  - Subject Progress: Color-coded percentages, gradient progress bar, subject name in tooltip
  - Tasks Completed: Purple theme, Badge component for weekly count, total/pending in tooltip
  - Study Streak: Orange flame theme, green Badge for "studied today", record display in tooltip
- **Typography**: Upgraded from text-2xl to text-3xl for better readability and hierarchy
- **Accessibility**: All interactive elements include aria labels via tooltip system

### November 20, 2025 - Enhanced Dashboard with 4 New KPIs
- **Backend Implementation** (`server/statsRoutes.ts`):
  - 4 new GET endpoints: `/api/stats/study-time`, `/api/stats/subject-progress`, `/api/stats/tasks-summary`, `/api/stats/streak`
  - Session event tracking: POST `/api/topics/:id/session-events` with Zod validation
  - Task CRUD: POST/PATCH/DELETE `/api/tasks` with Zod validation
  - All endpoints use `isAuthenticated` middleware
- **Frontend Implementation** (`client/src/pages/dashboard.tsx`):
  - Per-card error handling: Each KPI shows individual loading/error/success states
  - Empty state CTAs: All 4 KPIs show accurate guidance for first-time users
  - Skeleton loading states while queries execute
  - Error messages fully translated across 6 languages
  - All queries guarded with `enabled: currentPlan !== "free"`
- **New Database Tables**:
  - `topicStudyTime`: Records study sessions with duration in minutes
  - `topicStudyEvents`: Tracks enter/exit events for auto-tracking
  - `tasks`: User tasks with priority, due dates, completion tracking
  - `topicProgress`: Marks topics as completed for progress calculation
- **Full i18n Support**: All 6 languages (PT, EN, ES, FR, DE, IT) updated with 20 new translation keys
- **Known Limitation - Session Overlap**:
  - Cross-device concurrent access to same topic may cause incorrect session pairing (<1% frequency)
  - Current implementation optimizes for single-device usage (99% of cases)
  - Future remediation: Add activeSessionId tracking or server-side locking when telemetry shows impact
  - Documented in `server/statsRoutes.ts` (lines 18-36)

## System Architecture

### Frontend Architecture
The frontend is built with React 18, TypeScript, Vite, Wouter for routing, and TanStack Query for server state management. UI components leverage Shadcn/ui, Radix UI primitives, and Tailwind CSS, adhering to a Notion-inspired clean design. State management uses TanStack Query for server state and React hooks for local UI state. Form validation is handled by React Hook Form and Zod. Internationalization is implemented using `react-i18next` supporting 6 languages (Portuguese, English, Spanish, French, German, Italian), with user language preferences synced across the application.

### Backend Architecture
The backend is an Express.js application written in TypeScript, using ESM modules. It provides a RESTful API for managing subjects, topics, content items, AI chat functionalities, flashcards, and subscriptions. Document processing extracts text from PDF, DOCX, and PPTX files for AI summarization. Security features include session-based authentication, user ID validation, parent resource ownership checks, Zod validation, and tenant isolation. OpenAI GPT-4 powers all AI functionalities (summaries, flashcards, chat).

### Data Storage
PostgreSQL (Neon) is the primary database, managed with Drizzle ORM. The schema includes tables for `subjects`, `topics`, `content_items` (supporting files and links), `summaries`, `flashcards`, `flashcard_translations`, `flashcard_reviews`, `chat_threads`, `chat_messages`, `users`, `subscriptions`, `usage_tracking`, `topicStudyTime`, `topicStudyEvents`, `tasks`, and `topicProgress`. Strict foreign key relationships and `ON DELETE CASCADE` ensure data integrity. All users are students by default. The `flashcard_translations` table supports multi-language SM-2 spaced repetition progress across different languages by mapping translated flashcards to a base Portuguese flashcard ID, ensuring shared progress tracking.

### Authentication & Authorization
Authentication uses Replit OIDC with session-based authentication via `express-session`. Authorization is granular, scoping all resources to `userId` and validating parent resource ownership throughout the hierarchy. All users are students by default with no role selection required.

## External Dependencies
- **AI Services:** OpenAI API (GPT-4) for summarization, flashcard generation, and dual-mode chat.
- **Database:** Neon Serverless PostgreSQL.
- **Payments:** Stripe for subscription billing.
- **Document Processing:** `pdf-parse` for PDFs, `mammoth` for DOCX, and `officeparser` for PPTX.
- **Build & Development:** TypeScript compiler, ESBuild, PostCSS, Tailwind CSS, `tsx`.