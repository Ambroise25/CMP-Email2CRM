# Design Guidelines: Email Data Extraction Tool

## Design Approach
**System-Based Approach** using Material Design principles, inspired by Gmail and Linear for clean, functional interfaces optimized for information density and workflow efficiency.

## Core Design Principles
1. **Function First**: Prioritize data visibility and workflow efficiency over decoration
2. **Clear Hierarchy**: Distinguish between email content, extracted data, and system status
3. **Scannable Information**: Enable quick parsing of email lists and JSON output
4. **Professional Minimalism**: Clean, corporate aesthetic appropriate for data processing tools

## Typography System
- **Primary Font**: Inter (Google Fonts)
- **Monospace Font**: JetBrains Mono for JSON/code display
- **Hierarchy**:
  - Page titles: text-2xl font-semibold
  - Section headers: text-lg font-medium
  - Email subjects: text-base font-medium
  - Body text: text-sm
  - JSON/code: text-xs font-mono
  - Metadata/timestamps: text-xs text-gray-500

## Layout System
**Spacing**: Use Tailwind units of 2, 4, 6, and 8 consistently (p-4, gap-6, mt-8)

**Structure**: Single-column dashboard layout with max-w-6xl container

## Component Library

### 1. Connection Status Bar
Top bar showing IMAP connection status, account email, unread count
- Fixed position with border-b
- Includes: status indicator (green/red dot), account info, refresh button

### 2. Email List Panel
Gmail-inspired email list with:
- Checkbox for selection
- Sender name (font-medium)
- Subject line (truncated)
- Timestamp (text-xs, right-aligned)
- Unread indicator (bold styling)
- Hover state with subtle background change

### 3. Email Detail View
Two-pane layout when email selected:
- Left: Email metadata (from, to, date, subject) in definition list format
- Right: Email body content with proper text wrapping

### 4. JSON Output Display
Dedicated section below email detail:
- Dark code block background (bg-gray-900)
- Syntax-highlighted JSON with proper indentation
- Copy-to-clipboard button in top-right
- Extracted fields clearly labeled: syndic, adresse, code_postal, ville, référence, objet, gestionnaire, Métier

### 5. Configuration Panel
Collapsible settings section:
- Input fields for IMAP_HOST, IMAP_USER, IMAP_PASSWORD (type="password")
- Connection test button
- Status messages for success/error states

### 6. Action Buttons
- Primary: "Extract Data" (prominent, bg-blue-600)
- Secondary: "Mark as Read", "Refresh" (outlined style)
- Utility: "Copy JSON", "Export" (ghost style)

## Visual Patterns
- **Cards**: Use subtle borders (border border-gray-200) not shadows
- **States**: Clear visual feedback for loading, success, error
- **Dividers**: Use border-gray-200 for section separation
- **Icons**: Heroicons (outline style) for UI controls

## Animations
Minimal - only for state transitions:
- Loading spinner when fetching emails
- Fade-in for JSON output after extraction
- Subtle hover states on interactive elements

## Images
No images required - this is a data-focused utility interface.