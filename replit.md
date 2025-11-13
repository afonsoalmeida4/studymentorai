# AI Study Mentor

## Overview

AI Study Mentor is an educational productivity application that transforms PDF documents into personalized study summaries tailored to different learning styles. The application uses AI (OpenAI GPT-5) to analyze uploaded PDF content and generate summaries optimized for visual, auditory, logical, or concise learning preferences. Additionally, users can generate interactive flashcards from their summaries to enhance retention through active recall. The dashboard provides comprehensive progress tracking with PDFs studied, flashcard performance, study streaks, and AI-powered spaced repetition recommendations. Built with a modern React frontend and Express backend, it emphasizes clarity and user focus, drawing design inspiration from productivity tools like Notion, Linear, and Grammarly.

## Recent Changes (November 13, 2025)

### Gamification System (COMPLETED)
**Database Schema:**
- Extended `users` table with gamification fields: displayName, totalXp, currentLevel, premiumActive, premiumSince, lastDailyChatXp
- Created `xp_events` table to track XP awards with action type and metadata
- Created `chat_threads` and `chat_messages` tables for Premium AI mentor feature
- Defined 4 user levels: Iniciante (0-299 XP), Explorador (300-899), Mentor (900-1999), Mestre (2000+)
- All database migrations applied successfully

**Backend Implementation:**
- Created `shared/gamification.ts` with XP reward constants and helper functions
- Defined XP rewards: Upload PDF (+50), Generate Summary (+100), Flashcards (+30), Study Session (+20 + 5 per correct)
- Built `server/gamificationService.ts` with core gamification engine:
  - `awardXP()` - awards XP, detects level-ups, gives level-up bonus (+50 XP)
  - `getGamificationProfile()` - returns user stats, level info, recent XP events, rank
  - `getLeaderboard()` - top users by XP
  - `activatePremium()` - enables premium features
  - Daily chat XP limiting (once per day, +40 XP)
- **API Endpoints (NEW):**
  - `GET /api/gamification/profile` - Returns user XP, level, rank, and recent XP events
  - `GET /api/leaderboard` - Returns top 10 users by total XP
  - `POST /api/premium/activate` - Activates premium status for user
- **XP Integration:** Integrated awardXP() into existing routes:
  - PDF upload and summary generation (+50 XP upload, +100 XP summary)
  - Flashcard generation (+30 XP)
  - Study session completion (+20 XP base + 5 XP per correct answer)

**Frontend Implementation:**
- Created reusable `AppHeader` component with consistent navigation across all pages
- Built `Ranking` page (`/ranking`) with top 10 leaderboard, level badges, and user rank display
- Added Premium activation button to Dashboard with query invalidation
- Created gamification UI components: `LevelBadge`, `XPProgressBar`, `GamificationHeader`
- Updated all authenticated pages (Home, Dashboard, Ranking) to use AppHeader for navigation
- Icons configured for lucide-react (Feather, BookOpen, Brain, Rocket, Trophy)

**Navigation System:**
- Unified navigation header with buttons: Home, Dashboard, Ranking, Logout
- Client-side routing via wouter for seamless page transitions
- All navigation elements include data-testid attributes for testing

**Remaining Features for Full Gamification:**
- Premium AI Chat Mentor page (OpenAI integration)
- Achievement toasts for level-ups and milestones
- Premium golden theme styling
- Daily streak tracking and bonus XP

### Flashcard Generation Fix
- **Improved JSON parsing**: Added robust handling for markdown code blocks (```json) in AI responses
- **Better error handling**: Enhanced error messages and logging for flashcard generation failures
- **Validation**: Filter out flashcards missing required fields before returning to client
- **Resilience**: Gracefully handles malformed AI responses that previously caused generation to fail

### Dashboard Enhancements
**New Data Sections:**
- **PDFs Estudados**: Displays list of studied documents with:
  - Learning style used
  - Number of study sessions
  - Average accuracy per PDF
  - Last study date (relative time format)
- **Sessões Recentes**: Shows recent study activity with:
  - Document name
  - Correct/incorrect flashcard counts
  - Session accuracy percentage
  - Study date (relative time format)

**Empty State Handling:**
- Both new sections always visible, showing friendly empty states when no data exists
- Call-to-action buttons to encourage first upload or study session

**Backend Improvements:**
- Expanded `getDashboardStats` to aggregate per-PDF statistics
- Efficient SQL joins to retrieve recent sessions with full context
- Limits to 5 most recent items per section for optimal performance

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
  - `POST /api/generate-summary` - Generate personalized summary from PDF (awards +100 XP)
  - `POST /api/flashcards` - Generate flashcards from existing summary (awards +30 XP)
  - `GET /api/flashcards/:summaryId` - Retrieve flashcards for a summary
  - `POST /api/study-sessions` - Record study session progress (awards +20 XP + 5 per correct)
  - `GET /api/dashboard-stats` - Get user study statistics (PDFs, flashcards, streak, accuracy)
  - `GET /api/review-plan` - Get AI-generated personalized review recommendations
  - `GET /api/gamification/profile` - Get user XP, level, rank, and recent XP events
  - `GET /api/leaderboard` - Get top 10 users by total XP
  - `POST /api/premium/activate` - Activate premium status for user
- File upload handling via **Multer** middleware (in-memory storage, 10MB PDF limit)
- Request validation using **Zod** schemas shared between client and server
- Automatic XP awarding integrated into all user actions

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
- **PostgreSQL database** via Neon for all persistent storage
- **Drizzle ORM** for type-safe database operations
- **Database tables:**
  - `users` - User accounts and authentication
  - `summaries` - Generated study summaries with learning style metadata
  - `flashcards` - Interactive question/answer pairs linked to summaries
  - `study_sessions` - High-level study session tracking (date, flashcard counts, accuracy)
  - `flashcard_attempts` - Individual flashcard performance for spaced repetition

**Database Schema:**
- Schema defined in `shared/schema.ts`
- Migration strategy via Drizzle Kit (`npm run db:push`)
- Compound indices for efficient dashboard queries:
  - `(user_id, study_date DESC)` for streak calculations
  - `(user_id, summary_id)` for per-summary lookups
  - `(user_id, flashcard_id)` for attempt tracking
- Foreign key relationships maintain referential integrity

### Dashboard & Progress Tracking

**Features:**
- **Study Statistics Dashboard** (`/dashboard` route)
  - Total PDFs studied count
  - Flashcards completed count
  - Study streak calculation (consecutive days with activity)
  - Average accuracy percentage
  - Last 7 days progress visualization using Recharts
  
**AI-Powered Review System:**
- **Spaced Repetition Logic**: Identifies topics needing review based on:
  - Low accuracy scores (< 70%)
  - Time since last study session
  - Number of study sessions completed
- **GPT-5 Review Plan Generation**: Personalized recommendations with:
  - Priority topics (high/medium/low)
  - Specific reasons for review
  - Motivational study guidance in Portuguese
- **Robust Error Handling**: Graceful fallbacks for AI parsing failures

**Progress Tracking:**
- Study sessions record: date, flashcards attempted, correct/incorrect counts
- Individual flashcard attempts for spaced repetition algorithm
- Dashboard queries optimized with compound database indices

### Authentication & Authorization

**Current State:**
- **Replit OIDC Authentication** (javascript_log_in_with_replit integration)
- Session-based authentication with express-session
- User data stored in PostgreSQL users table
- Protected routes require authentication

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