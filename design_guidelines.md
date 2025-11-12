# AI Study Mentor — Design Guidelines

## Design Approach

**Selected Approach:** Design System with Modern Productivity App References (Notion, Linear, Grammarly)

**Rationale:** Educational productivity tool requiring clarity, trust, and efficiency. Users need to focus on content, not interface complexity.

## Typography Hierarchy

**Font Families:**
- Primary: Inter (Google Fonts) — UI elements, body text, buttons
- Secondary: Source Serif Pro (Google Fonts) — Generated summaries for readability

**Scale:**
- Hero Heading: text-5xl font-bold (main title)
- Section Headings: text-2xl font-semibold
- Card Titles: text-lg font-medium
- Body Text: text-base leading-relaxed
- Summary Content: text-lg leading-loose (Source Serif Pro)
- Motivational Quote: text-xl italic font-light

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16, 20

**Container Strategy:**
- Max width: max-w-4xl for main content (optimal reading)
- Upload section: max-w-2xl centered
- Results: max-w-5xl (wider for comfortable reading)

**Vertical Rhythm:**
- Section spacing: py-16 (desktop), py-12 (mobile)
- Component spacing: gap-8 between major elements, gap-4 within components

## Page Structure

### Hero Section (60vh)
- Centered content with max-w-3xl
- Large heading + descriptive subtitle
- Brief explanation of how it works (3-4 lines)
- No hero image — focus on clarity and getting started

### Upload Interface (Primary Section)
- Single-column centered layout
- Large drag-drop zone with dashed border (min-h-64)
- File type indicator (PDF icon via Heroicons)
- File size limit display (e.g., "Max 10MB")
- Selected file preview card showing filename, size, remove option

### Learning Style Selection
- 2x2 grid on desktop (grid-cols-2), single column mobile
- Each style as interactive card:
  - Icon at top (Heroicons: eye for Visual, speaker for Auditivo, etc.)
  - Style name in text-xl font-semibold
  - 2-3 line description in text-sm
  - Distinct selected state with border emphasis
  - Hover scale effect (scale-105)

### Summary Display
- Full-width card with subtle border
- Header showing: PDF filename, selected learning style badge, timestamp
- Summary content in Source Serif Pro, text-lg, generous line-height
- Motivational message in distinct callout card at bottom
- Download/Share action buttons

### Features Section (Below Hero)
- 3-column grid (desktop), single column (mobile)
- Icons + short benefit statements
- Examples: "Adapts to You", "AI-Powered", "Save Time"

## Component Library

### Buttons
**Primary CTA:**
- Large padding (px-8 py-4)
- Rounded-lg
- Font-semibold text-base
- Use on hero ("Get Started") and upload ("Generate Summary")

**Secondary:**
- Ghost style with border
- px-6 py-3
- For actions like "Download", "Try Another"

### Cards
**Default Card:**
- Rounded-xl
- Border (1px)
- Padding: p-6 to p-8
- Subtle shadow on hover

**Selection Cards (Learning Styles):**
- p-6, rounded-lg
- Cursor pointer
- Text-center
- Icon mb-4, size-8

### Form Elements
**File Input:**
- Hidden native input
- Custom drag-drop area with:
  - Dashed border-2
  - p-12 vertical padding
  - Upload icon (size-12) centered
  - Instructions below icon

### Loading States
**Processing Indicator:**
- Centered spinner (Heroicons: arrow-path with animate-spin)
- Progress text: "Extracting text...", "Generating summary..."
- Estimated time indicator if possible

### Badges
- Small rounded-full tags
- px-3 py-1 text-sm
- For showing learning style, PDF status

## Icons

**Library:** Heroicons (via CDN)

**Icon Usage:**
- Document icon: PDF upload area
- Academic cap: Main logo/header
- Light bulb: Motivational section
- Eye/Ear/Brain/Lightning: Learning style icons
- Arrow path: Loading spinner
- Check circle: Success states
- X mark: Remove file

## Accessibility

- Keyboard navigation for learning style selection (arrow keys)
- Screen reader labels for file upload area
- Focus indicators on all interactive elements (ring-2 with offset)
- Semantic HTML (main, section, article for summary)
- Error messages with clear instructions

## Special Considerations

**Summary Presentation:**
- Generous whitespace around text blocks
- Clear visual separation between summary sections
- Motivational message in distinct treatment (italic, larger text, border-l accent)

**Empty States:**
- Before upload: Encouraging message with upload icon
- After processing: Quick access to upload another file

**Mobile Optimization:**
- Stack all multi-column layouts
- Larger touch targets (min 44px height)
- Simplified upload zone on small screens

## Animations

**Minimal & Purposeful:**
- Upload zone: Scale on drag-over
- Learning style cards: Gentle hover lift
- Success: Subtle fade-in for summary (duration-300)
- No scroll-triggered animations

---

**Design Philosophy:** Create a calm, focused environment that empowers learning. Every element should reduce cognitive load and guide users naturally through: Upload → Customize → Learn.