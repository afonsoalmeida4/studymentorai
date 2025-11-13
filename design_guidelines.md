# AI Study Mentor — Design Guidelines

## Design Approach

**Selected Approach:** Design System inspired by Notion, Linear, and Grammarly

**Rationale:** Knowledge management platform requiring exceptional clarity, calm focus, and intuitive organization. Interface must fade into the background while empowering deep work and reflection.

**Portuguese Context:** All UI text in Portuguese. Slogan: "Organiza o teu conhecimento. Encontra o teu equilíbrio."

## Typography Hierarchy

**Font Families:**
- Primary: Inter (Google Fonts) — UI, navigation, headings
- Secondary: Source Serif Pro (Google Fonts) — Long-form content, AI responses, study materials

**Scale:**
- Page Titles: text-3xl font-bold
- Section Headers: text-xl font-semibold
- Card Titles: text-lg font-medium
- Body Text: text-base leading-relaxed
- AI Responses: text-lg leading-loose (Source Serif Pro)
- Sidebar Items: text-sm font-medium
- Metadata: text-xs

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 24

**Application Layout:**
- Sidebar: Fixed width 280px (w-72), full height, left-aligned
- Main Content: Full remaining width with max-w-5xl centered padding
- Dual-pane views: 60/40 split (content left, AI assistant right)

**Vertical Rhythm:**
- Page sections: py-12
- Component groups: gap-8
- List items: gap-4
- Tight groupings: gap-2

## Page Structure

### Landing Page

**Hero Section (80vh):**
- Centered content max-w-4xl
- Main headline: "Organiza o teu conhecimento. Encontra o teu equilíbrio." (text-5xl font-bold)
- Subheading explaining the platform (2-3 lines, text-xl)
- Large hero image showing organized study dashboard with serene aesthetic
- Dual CTAs: "Começar Agora" (primary) + "Ver Como Funciona" (secondary ghost)

**Features Section:**
- 3-column grid (desktop), single column (mobile)
- Each feature: Icon (size-10) + title + 2-line description
- Features: "Organização Hierárquica", "Assistente AI Dual", "Multi-formato"

**How It Works Section:**
- 4-step visual walkthrough with numbered steps
- Left-right alternating layout (image-text-image-text)
- Screenshots showing: 1) Upload, 2) Organization, 3) Study Mode, 4) Existential Mode

**Social Proof:**
- 2-column testimonial grid
- Student quotes about focus and organization improvements

**Final CTA Section:**
- Centered max-w-3xl
- Motivational headline about balanced learning
- Large CTA button

### Application Dashboard

**Sidebar (Left, Fixed):**
- Logo/app name at top (py-6)
- Search bar (rounded-lg, px-4 py-2)
- Hierarchical tree navigation:
  - Subjects (expandable/collapsible with chevron icons)
  - Topics nested with indentation (pl-6)
  - Current item highlighted with subtle background
- Bottom section: AI Mode toggle (Study/Existential) with icons, Settings link

**Main Content Area:**
- Breadcrumb navigation (text-sm, mb-6)
- Topic header: Title + metadata (last edited, file count)
- File cards in masonry grid (2-3 columns desktop)
- Each card: File icon, name, type badge, preview snippet, action menu
- Empty state: Centered illustration + "Adiciona o teu primeiro material"

**AI Assistant Panel (Right, Toggleable):**
- Fixed 400px width when open, slides from right
- Mode indicator at top (Study/Existential badge)
- Chat interface:
  - User messages: Right-aligned, rounded bubbles
  - AI responses: Left-aligned, Source Serif Pro, generous spacing
  - Input area at bottom with send button
- Mode-specific UI:
  - Study Mode: Related content suggestions below responses
  - Existential Mode: Breathing exercise widget, focus timer

## Component Library

### Navigation
**Sidebar Tree Items:**
- Hover: Subtle background shift
- Active: Distinct background with border accent
- Expandable items: Chevron icon rotates on expand
- Drag handles for reordering (visible on hover)

### Cards
**File Cards:**
- Rounded-xl, p-6
- File type icon (top-left, size-8)
- Title (text-lg font-medium)
- Preview text (2 lines, truncated, text-sm)
- Metadata footer (date, size, text-xs)
- Hover: Lift with shadow increase

**Topic Cards:**
- Larger p-8
- Topic name + description
- File count badge
- Quick action buttons (Edit, Delete)

### Buttons
**Primary CTA:**
- px-8 py-4, rounded-lg, font-semibold
- Use for main actions ("Adicionar Material", "Começar")

**Secondary:**
- px-6 py-3, ghost with border
- For "Cancelar", "Ver Mais"

**Icon Buttons:**
- size-10, rounded-lg
- For quick actions in cards/lists

### Forms
**File Upload Zone:**
- Dashed border-2, rounded-xl
- Large drop area (min-h-48)
- Multi-format icons displayed (PDF, DOC, PPT, Link)
- "Arrasta ficheiros ou clica para escolher" text

**Input Fields:**
- Rounded-lg, px-4 py-3
- Focus: Ring with offset
- Labels: text-sm font-medium mb-2

### AI Chat
**Message Bubbles:**
- User: Rounded-2xl (rounded-br-sm), max-w-md
- AI: Rounded-2xl (rounded-bl-sm), max-w-lg, Source Serif Pro

**Mode Toggle:**
- Segmented control style
- Icons: book-open (Study), heart (Existential)
- Active segment has distinct background

### Modals
**Create/Edit Dialogs:**
- Centered overlay with blur backdrop
- max-w-2xl, rounded-2xl, p-8
- Header with title + close button
- Form content area
- Footer with action buttons (right-aligned)

## Icons

**Library:** Heroicons (via CDN)

**Icon Mapping:**
- Academic cap: Logo, Study mode
- Heart: Existential mode
- Folder: Subjects
- Document: Topics/files
- Link: URL materials
- Chart bar: Progress/stats
- Cog: Settings
- Magnifying glass: Search
- Plus: Add actions
- Chevron: Expandable items

## Images

**Hero Image:**
- Large (60% viewport width), right-aligned
- Show clean dashboard interface with organized hierarchy
- Serene aesthetic: minimalist, calm, organized workspace
- Subtle gradient overlays for depth

**Feature Section Images:**
- Screenshot mockups showing actual interface
- Annotated to highlight key features
- Rounded corners (rounded-xl)

**How It Works Screenshots:**
- Full-interface captures showing workflow
- Alternating left-right for visual rhythm
- Maintain aspect ratio, max-w-xl

## Accessibility

- Keyboard navigation through sidebar tree (arrow keys expand/collapse, tab navigates)
- Focus indicators on all interactive elements (ring-2)
- ARIA labels for icon-only buttons
- Screen reader announcements for AI mode switching
- Semantic HTML: nav for sidebar, main for content, aside for AI panel
- Skip links for keyboard users

## Special Considerations

**Hierarchy Visualization:**
- Indentation levels clearly distinguished (4px per level)
- Visual lines connecting parent-child relationships
- Subtle icons differentiating subjects vs. topics

**AI Mode Distinction:**
- Study Mode: Professional tone, content-focused, structured responses
- Existential Mode: Warm, supportive, includes breathing exercises and reflection prompts

**Empty States:**
- Encouraging illustrations (not generic)
- Clear next steps ("Cria o teu primeiro tema")
- Example structures users can copy

**Responsive Behavior:**
- Mobile: Sidebar becomes slide-out drawer with hamburger toggle
- AI panel overlays on tablet/mobile
- File cards stack to single column

**Animations:**
- Sidebar expand/collapse: Smooth height transition (duration-200)
- Modal entry: Fade + scale (duration-300)
- No scroll animations
- Hover states: Subtle transform (scale-102) on cards

---

**Design Philosophy:** Create a sanctuary for learning and reflection. Interface should be invisible, allowing users to focus entirely on their knowledge and growth. Every interaction reinforces calm, organization, and balance.