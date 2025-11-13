# AI Study Mentor

## Overview

AI Study Mentor is an educational productivity application that transforms PDF documents into personalized study summaries tailored to different learning styles. The application uses AI (OpenAI GPT-5) to analyze uploaded PDF content and generate summaries optimized for visual, auditory, logical, or concise learning preferences. Additionally, users can generate interactive flashcards from their summaries to enhance retention through active recall. Built with a modern React frontend and Express backend, it emphasizes clarity and user focus, drawing design inspiration from productivity tools like Notion, Linear, and Grammarly.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling:**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server for fast HMR and optimized production builds
- **Wouter** for lightweight client-side routing (single-page application)
- **TanStack Query (React Query)** for server state management, caching, and API interactions

**UI Component System:**
- **shadcn/ui** component library with Radix UI primitives for accessible, customizable components
- **Tailwind CSS** for utility-first styling with custom design tokens
- **Design System**: "new-york" style variant with neutral base color and CSS variables for theming
- Typography hierarchy uses Inter (primary) and Source Serif Pro (secondary for generated summaries)

**State Management:**
- Server state handled via TanStack Query
- Local UI state managed with React hooks
- Form state using React Hook Form with Zod validation

**Key Design Decisions:**
- Component-based architecture with reusable UI primitives
- Path aliases (`@/`, `@shared/`) for clean imports
- Mobile-first responsive design approach
- Focus on readability and minimal interface complexity

### Backend Architecture

**Framework:**
- **Express.js** with TypeScript for the REST API server
- **ESM modules** (type: "module") for modern JavaScript syntax

**API Structure:**
- RESTful endpoints:
  - `POST /api/generate-summary` - Generate personalized summary from PDF
  - `POST /api/flashcards` - Generate flashcards from existing summary
  - `GET /api/flashcards/:summaryId` - Retrieve flashcards for a summary
- File upload handling via **Multer** middleware (in-memory storage, 10MB PDF limit)
- Request validation using **Zod** schemas shared between client and server

**AI Integration:**
- **OpenAI API** (GPT-5 model) for generating personalized summaries and flashcards
- Four learning style prompts: visual, auditory, logical, and concise
- Generates both summary content and motivational messages
- Flashcard generation creates 5-10 question/answer pairs from summary content
- Caches generated flashcards to avoid duplicate generation and reduce API costs

**Middleware & Utilities:**
- Request logging with timing and response capture
- JSON body parsing with raw body preservation
- CORS and security headers (implied by Express setup)
- Development mode integrations: Replit cartographer and dev banner

**Storage Layer:**
- PostgreSQL database for persistent storage
- Interface-based design (`IStorage`) for database operations
- Persistent storage for summaries and flashcards linked to user accounts
- Flashcards are associated with summaries via foreign key relationship

### Data Storage Solutions

**Current Implementation:**
- **In-memory storage** for user accounts (temporary, session-based)
- No persistent storage for generated summaries (stateless generation)

**Database Configuration (Prepared but Not Active):**
- **Drizzle ORM** configured with PostgreSQL dialect
- **Neon Database** serverless driver (`@neondatabase/serverless`)
- Schema defined in `shared/schema.ts`
- Migration strategy via Drizzle Kit (`db:push` script)
- Session management infrastructure via `connect-pg-simple`

**Rationale for Current Approach:**
- Simplifies initial deployment and development
- Reduces infrastructure dependencies
- Future-ready with database configuration in place

### Authentication & Authorization

**Current State:**
- Basic user schema defined (`User`, `InsertUser` types)
- User storage interface implemented
- No active authentication flow in use
- Prepared for future session-based authentication (express-session infrastructure present)

### External Dependencies

**AI Services:**
- **OpenAI API**: GPT-5 model for text summarization and content generation
- Requires `OPENAI_API_KEY` environment variable

**Database (Configured):**
- **Neon Database**: Serverless PostgreSQL (not currently active)
- Requires `DATABASE_URL` environment variable when enabled

**Development Tools:**
- **Replit-specific plugins**: Runtime error modal, cartographer, dev banner
- Google Fonts: Inter, Source Serif Pro, Architects Daughter, DM Sans, Fira Code, Geist Mono

**Core Libraries:**
- PDF processing capability implied (PDF text extraction needed for implementation)
- Date manipulation via `date-fns`
- Form validation via `react-hook-form` with `@hookform/resolvers`

**Build & Development:**
- **TypeScript** compiler for type checking
- **ESBuild** for server-side bundling
- **PostCSS** with Tailwind CSS and Autoprefixer
- **tsx** for running TypeScript in development

### API Design

**Endpoints:**
```
POST /api/generate-summary
- Accepts: multipart/form-data (PDF file + learningStyle)
- Returns: { success: boolean, summary?: Summary, error?: string }
- Learning styles: "visual" | "auditivo" | "logico" | "conciso"
```

**Type Safety:**
- Shared Zod schemas between frontend and backend
- Request/response types exported from `@shared/schema`
- Runtime validation on API requests

### Error Handling

- Client-side error boundaries via Replit runtime error modal plugin
- Toast notifications for user-facing errors
- API error responses with structured error messages
- File upload validation (type and size constraints)