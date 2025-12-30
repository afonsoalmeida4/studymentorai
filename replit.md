# Study Mentor AI

## Overview
Study Mentor AI is a Notion-style knowledge organization platform designed to help users structure, process, and study academic materials with integrated AI support. It enables the creation of hierarchical knowledge structures (Subjects → Topics → Content Items), supports uploads of various document types (PDF, Word, PowerPoint), and allows for the addition of external links. Key features include personalized AI summaries with multiple learning styles, a dual-mode AI assistant for academic and existential support, Anki-style flashcards with SM-2 spaced repetition, gamification with XP and levels, and a tiered subscription model (Free, Pro, Premium). The platform aims to provide a calm and clean interface inspired by Notion, Linear, and Grammarly, combining hierarchical organization with generative AI.

## User Preferences
- Communication: Simple, everyday language (Portuguese)
- Design inspiration: Notion, Linear, Grammarly (calm, clean, organized)

## System Architecture

### Frontend Architecture
The frontend is built with React 18, TypeScript, Vite, Wouter for routing, and TanStack Query for server state management. UI components leverage Shadcn/ui, Radix UI primitives, and Tailwind CSS, adhering to a Notion-inspired clean design. Form validation is handled by React Hook Form and Zod. Internationalization is implemented using `react-i18next` supporting 6 languages (Portuguese, English, Spanish, French, German, Italian). All components are optimized for mobile responsiveness (iPhone 16 Pro).

### Backend Architecture
The backend is an Express.js application written in TypeScript, using ESM modules, providing a RESTful API. Document processing extracts text from PDF, DOCX, and PPTX files for AI summarization. Security includes session-based authentication, user ID validation, parent resource ownership checks, Zod validation, and tenant isolation. OpenAI GPT-4 powers all AI functionalities.

### Data Storage
PostgreSQL (Neon) is the primary database, managed with Drizzle ORM. The schema supports subjects, topics, content items, summaries, flashcards, chat threads, users, subscriptions, usage tracking, and an academic calendar. All users are students by default. Flashcard translations support multi-language SM-2 spaced repetition progress.

### Authentication & Authorization
Authentication uses Supabase Authentication with JWT-based tokens and Google OAuth. Authorization is granular, scoping all resources to `userId` and validating parent resource ownership. New users are automatically created in the app database upon first authentication via Supabase.

### Key Features
- **Flashcard System**: Manual flashcard creation with SM-2 spaced repetition, supporting multi-language progress tracking and automatic translation of flashcards to 6 languages using GPT-4.
- **PDF Export**: Premium feature for exporting AI-generated summaries to professionally formatted PDFs.
- **Internationalized Error Messages**: Backend returns structured error codes for client-side translation.
- **Subscription Management**: Users can cancel subscriptions, reverting to the free plan.
- **Topic Completion Tracking**: Users can mark topics as complete/incomplete.
- **Dashboard KPIs**: Enhanced dashboard with Studley AI-inspired design, featuring Study Time, Subject Progress, Tasks Completed, and Study Streak with gradient cards, animations, and mobile optimization.
- **Flashcard Statistics**: Anki-style KPIs including a GitHub-style activity heatmap, daily averages, and streaks, fully internationalized.
- **Academic Calendar**: Premium feature for organizing exams and assignments with monthly and list views, event filtering, and completion tracking, fully internationalized.
- **Smart Quizzes (AI-Powered)**: Premium feature for AI-generated multiple-choice quizzes from topic summaries, including bilingual AI explanations, progress tracking, and results dashboard.
- **Dual-Mode Chat**: AI assistant with a Study mode (all users) and an Existential mode (Pro+ subscription).
- **Background Summary Generation**: Summary generation persists across navigation using a global React Context, with a queue system and per-style error handling.
- **Performance Optimizations**: Parallelized flashcard translation and immediate UI feedback for API calls.
- **Invisible Cost Controls**: Backend-only AI cost management (e.g., input size, summary depth, chat context, file size, frequency protection) that silently adjusts behavior based on user plan without exposing limits to the user.

## External Dependencies
- **AI Services:** OpenAI API (GPT-4)
- **Database:** Neon Serverless PostgreSQL
- **Authentication:** Supabase Authentication
- **Payments:** Stripe
- **Document Processing:** `pdf-parse`, `mammoth`, `officeparser`