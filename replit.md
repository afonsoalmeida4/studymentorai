# AI Study Mentor

## Overview
AI Study Mentor is a Notion-style knowledge organization platform designed to help users structure, process, and study academic materials with integrated AI support. It enables the creation of hierarchical knowledge structures (Subjects → Topics → Content Items), supports uploads of various document types (PDF, Word, PowerPoint), and allows for the addition of external links. Key features include personalized AI summaries with multiple learning styles, a dual-mode AI assistant for academic and existential support, Anki-style flashcards with SM-2 spaced repetition, gamification with XP and levels, and a tiered subscription model (Free, Pro at 6.19€/month or 59.99€/year, Premium at 12.29€/month or 119.99€/year with ~19% yearly savings). The platform aims to provide a calm and clean interface inspired by Notion, Linear, and Grammarly, combining hierarchical organization with generative AI.

## User Preferences
- Communication: Simple, everyday language (Portuguese)
- Design inspiration: Notion, Linear, Grammarly (calm, clean, organized)

## Recent Changes

### November 20, 2025
- **Subscription Pricing Corrected**: Updated subscription prices across all platforms
  - Pro: 6.19€/month or 59.99€/year (~19% discount)
  - Premium: 12.29€/month or 119.99€/year (~19% discount)
  - Added monthly/yearly billing toggle on subscription page
  - Backend accepts `billingPeriod` parameter for Stripe checkout
  - Translations updated in all 6 languages (PT, EN, ES, FR, DE, IT)
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