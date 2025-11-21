# AI Study Mentor

## Overview
AI Study Mentor is a Notion-style knowledge organization platform designed to help users structure, process, and study academic materials with integrated AI support. It enables the creation of hierarchical knowledge structures (Subjects → Topics → Content Items), supports uploads of various document types (PDF, Word, PowerPoint), and allows for the addition of external links. Key features include personalized AI summaries with multiple learning styles, a dual-mode AI assistant for academic and existential support, Anki-style flashcards with SM-2 spaced repetition, gamification with XP and levels, and a tiered subscription model (Free, Pro, Premium). The platform aims to provide a calm and clean interface inspired by Notion, Linear, and Grammarly, combining hierarchical organization with generative AI.

## User Preferences
- Communication: Simple, everyday language (Portuguese)
- Design inspiration: Notion, Linear, Grammarly (calm, clean, organized)

## System Architecture

### Frontend Architecture
The frontend is built with React 18, TypeScript, Vite, Wouter for routing, and TanStack Query for server state management. UI components leverage Shadcn/ui, Radix UI primitives, and Tailwind CSS, adhering to a Notion-inspired clean design. State management uses TanStack Query for server state and React hooks for local UI state. Form validation is handled by React Hook Form and Zod. Internationalization is implemented using `react-i18next` supporting 6 languages (Portuguese, English, Spanish, French, German, Italian), with user language preferences synced across the application.

### Backend Architecture
The backend is an Express.js application written in TypeScript, using ESM modules. It provides a RESTful API for managing subjects, topics, content items, AI chat functionalities, flashcards, and subscriptions. Document processing extracts text from PDF, DOCX, and PPTX files for AI summarization. Security features include session-based authentication, user ID validation, parent resource ownership checks, Zod validation, and tenant isolation. OpenAI GPT-4 powers all AI functionalities (summaries, flashcards, chat).

### Data Storage
PostgreSQL (Neon) is the primary database, managed with Drizzle ORM. The schema includes tables for `subjects`, `topics`, `content_items` (supporting files and links), `summaries`, `flashcards`, `flashcard_translations`, `flashcard_reviews`, `chat_threads`, `chat_messages`, `users`, `subscriptions`, `usage_tracking`, `topicStudyTime`, `topicStudyEvents`, `tasks`, `topicProgress`, and `calendar_events`. Strict foreign key relationships and `ON DELETE CASCADE` ensure data integrity. All users are students by default. The `flashcard_translations` table supports multi-language SM-2 spaced repetition progress across different languages by mapping translated flashcards to a base Portuguese flashcard ID, ensuring shared progress tracking. The `calendar_events` table stores academic calendar events (exams and assignments) with optional associations to subjects/topics and completion tracking.

### Authentication & Authorization
Authentication uses Replit OIDC with session-based authentication via `express-session`. Authorization is granular, scoping all resources to `userId` and validating parent resource ownership throughout the hierarchy. All users are students by default with no role selection required.

### Key Features
- **Flashcard System**: Manual flashcard creation and management, integrated with the SM-2 spaced repetition system, supporting multi-language progress tracking. Includes CRUD operations and filtering.
- **Automatic Flashcard Translation**: All flashcards (manual and auto-generated) are automatically translated to all 6 supported languages using GPT-4 with educational-focused prompts. Translations are created at flashcard creation time and stored in the `flashcard_translations` table, enabling seamless language switching while preserving SM-2 progress across all languages.
- **Flashcard Migration Tool**: Admin endpoint `/api/admin/migrate-flashcards` for one-time migration of legacy flashcards without translations. Uses robust JSON validation and detailed error reporting. Note: Current implementation is functional for small batches but lacks retry/backoff, idempotency guards, and concurrency locks for production-scale migrations.
- **PDF Export**: Premium-only feature allowing export of AI-generated summaries to professionally formatted PDFs, including app branding and metadata.
- **Internationalized Error Messages**: Backend returns structured error codes and parameters for client-side translation, providing dynamic and language-sensitive error messages.
- **Subscription Management**: Users can cancel subscriptions, immediately reverting to the free plan.
- **Dashboard KPIs**: Enhanced dashboard with 4 new key performance indicators (Study Time, Subject Progress, Tasks Completed, Study Streak) with visual enhancements including contextual colors, larger icons, gradient progress bars, animations, tooltips, and improved empty states.
- **Academic Calendar**: Premium-only feature for organizing exams and assignments. Supports monthly and list views, event filtering (upcoming/past/completed/by-type), mandatory subject association (enforced at database level with NOT NULL constraint), optional topic association, completion tracking, responsive UI with overflow handling for calendar dialogs, and full internationalization. All calendar data automatically displays in the user's current language. Frontend includes defensive logic to handle edge cases with legacy events.

## External Dependencies
- **AI Services:** OpenAI API (GPT-4) for summarization, flashcard generation, and dual-mode chat.
- **Database:** Neon Serverless PostgreSQL.
- **Payments:** Stripe for subscription billing.
- **Document Processing:** `pdf-parse` for PDFs, `mammoth` for DOCX, and `officeparser` for PPTX.
- **Build & Development:** TypeScript compiler, ESBuild, PostCSS, Tailwind CSS, `tsx`.