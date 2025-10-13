# Project Structure

This document outlines the cleaned and organized structure of the Chatbot Reporting Dashboard.

## Directory Structure

```
src/
├── components/
│   ├── features/           # Feature-specific components
│   │   └── ConversationSearch.tsx
│   ├── layout/            # Layout and header components
│   │   └── AppHeader.tsx
│   ├── ui/                # Reusable UI components (shadcn/ui)
│   │   ├── alert.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── pagination.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── textarea.tsx
│   │   └── utils.ts
│   ├── AttributesView.tsx  # Main feature components
│   ├── ConversationDetail.tsx
│   ├── JsonUpload.tsx
│   ├── SavedChats.tsx
│   └── ThreadsOverview.tsx
├── hooks/                 # Custom React hooks
│   ├── useAppState.ts     # Main app state management
│   ├── useConversationSearch.ts
│   └── useEnvironmentManager.ts
├── lib/                   # Utilities and types
│   ├── api.ts
│   ├── mockData.ts
│   ├── types.ts
│   └── utils.ts
├── styles/               # Global styles
│   └── globals.css
├── App.tsx              # Main application component (cleaned)
├── index.css
└── main.tsx
```

## Key Improvements Made

### 1. **Removed Unnecessary Files**
- Deleted backup archives (.zip, .tar.gz files)
- Removed unused deployment configurations
- Cleaned up installer and launcher files from root

### 2. **Cleaned Dependencies**
- Removed unused Radix UI components from package.json
- Kept only essential dependencies:
  - Core React and TypeScript
  - Essential Radix UI components (checkbox, dialog, label, select, slot, tabs)
  - Utility libraries (clsx, tailwind-merge, class-variance-authority)
  - Icons (lucide-react)
  - Charts (recharts)

### 3. **Restructured Components**
- **App.tsx**: Reduced from 1293 lines to ~400 lines by extracting logic into hooks
- **Hooks**: Created dedicated hooks for state management, search, and environment handling
- **Layout Components**: Separated header and navigation into dedicated components
- **Feature Components**: Organized feature-specific components

### 4. **Removed Unused UI Components**
Removed 25+ unused shadcn/ui components, keeping only:
- alert, badge, button, card, checkbox, input, label
- pagination, select, table, tabs, textarea, utils

### 5. **Improved Code Organization**
- **Separation of Concerns**: Logic extracted to custom hooks
- **Component Composition**: Smaller, focused components
- **Type Safety**: Maintained TypeScript throughout
- **Consistent Patterns**: Standardized callback patterns and state management

## Development Guidelines

### Adding New Components
- Place UI components in `src/components/ui/`
- Place feature components in `src/components/features/`
- Place layout components in `src/components/layout/`

### State Management
- Use custom hooks in `src/hooks/` for complex state logic
- Keep components focused on presentation
- Use TypeScript for all new code

### Dependencies
- Only add dependencies that are actively used
- Prefer composition over large component libraries
- Keep bundle size minimal

## Build and Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The cleaned codebase is now more maintainable, has a smaller bundle size, and follows modern React patterns.
