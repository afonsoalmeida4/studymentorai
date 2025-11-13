# AI Study Mentor

## Overview

AI Study Mentor is a Notion-style knowledge organization platform that empowers users to structure, process, and study academic materials with AI support. It allows for the creation of knowledge hierarchies (Subjects → Topics → Content Items), uploading various document types (PDF, Word, PowerPoint), adding external links, generating personalized AI summaries, and interacting with a dual-mode AI assistant for academic and existential support. The platform aims to combine hierarchical knowledge organization with generative AI, offering a calm and clean interface inspired by Notion, Linear, and Grammarly.

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

PostgreSQL (Neon) is used as the primary database, with Drizzle ORM for type-safe queries. The schema defines tables for `subjects`, `topics`, `content_items` (polymorphic for files and links), `summaries`, `chat_threads`, `chat_messages`, and `users`, with strict foreign key relationships and `ON DELETE CASCADE` for data integrity. Indices are strategically placed for efficient data retrieval.

### Authentication & Authorization

Authentication is handled via Replit OIDC, using session-based authentication with `express-session`. All resources are scoped to the `userId`, with robust authorization rules ensuring parent resource ownership validation and preventing cross-tenant data access.

## External Dependencies

- **AI Services:** OpenAI API (GPT-4) for summarization, flashcard generation, and the dual-mode chat assistant.
- **Database:** Neon Serverless PostgreSQL.
- **Document Processing:** `pdf-parse` for PDF, `mammoth` for DOCX, and `officeparser` for PPTX text extraction.
- **Build & Development:** TypeScript compiler, ESBuild, PostCSS, Tailwind CSS, and `tsx`.