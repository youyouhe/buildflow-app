# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start dev server with Turbopack
- `npm run build` — Production build with Turbopack
- `npm run start` — Start production server
- No test framework is configured; all changes require manual testing
- No ESLint or Prettier config exists in the repo

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
NEXT_PUBLIC_GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_APP_NAME=BuildFlow
NEXT_PUBLIC_APP_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Architecture

BuildFlow is an AI-powered website builder built on **Next.js 15 (App Router)** with **React 19** and **TypeScript** (strict mode). It uses a local-first architecture where project data lives in the browser's IndexedDB, with optional sync to GitHub repos.

### Data Flow

User prompt → AI provider (streaming) → generated HTML/CSS/JS files → stored in IndexedDB → optionally pushed to GitHub → deployed to GitHub Pages/Vercel

### Key Layers

- **AI providers** (`lib/ai-providers/`): Factory pattern with implementations for OpenAI, Google Gemini, DeepSeek, and OpenRouter. `factory.ts` resolves the correct provider. Models defined in `lib/providers.ts`.
- **IndexedDB storage** (`lib/indexeddb/`): Three stores — projects, apiKeys (AES-256 encrypted with GitHub token), settings. The `idb` library wraps the raw API. Auto-migrates from localStorage.
- **GitHub integration** (`lib/github/`): Octokit-based repo CRUD, content sync, and Pages deployment.
- **Supabase backend** (`lib/supabase/`): Powers the community features (sharing, likes, downloads). Schema in `supabase/migrations/`.
- **AI prompts** (`lib/prompts.ts`): Large file (~46KB) containing all system prompts for AI generation.

### State Management

- **TanStack Query** for server/async state
- **React Context** for global UI state — providers are nested in `app/layout.tsx`:
  - `AppContext` — app-wide state (current project, editor state)
  - `LoginContext` — GitHub OAuth flow
  - `ProContext` — pro/premium feature gates
  - `UserContext` — authenticated user info
- **Custom hooks** (`hooks/`): `useAi` (AI generation logic), `useEditor` (project editor state), `useUser` (auth), `useProviderHealth` (model availability)

### API Routes (`app/api/`)

All API routes use Next.js App Router convention (`route.ts` exports). Key routes:
- `ai/generate` — streaming AI generation
- `ai/validate` — validate AI API keys
- `github/auth/callback` — OAuth token exchange
- `github/repos/` — repo CRUD
- `community/projects/` — community sharing CRUD
- `cors-proxy` — proxy for cross-origin requests
- `provider-health` — check AI provider availability

### Routing

- `/` — landing page (in `app/(public)/`)
- `/projects/[namespace]/[repoId]` — project editor
- `/community` — community showcase
- `/settings` — user settings
- `/new` — new project creation
- `/auth/callback` — GitHub OAuth callback

## Code Style

- **Path alias**: `@/*` maps to project root (e.g., `@/components/ui/button`)
- **Component files**: `.tsx` for React components, `.ts` for utilities
- **Naming**: PascalCase components, kebab-case folders, camelCase functions, UPPER_SNAKE_CASE constants
- **Import order**: external libraries first, then internal `@/` imports
- **Components**: exported as arrow functions, `"use client"` directive for client components
- **UI library**: shadcn/ui (New York style) with Radix UI primitives, Lucide icons
- **Styling**: Tailwind CSS 4 with CSS variables defined in `assets/globals.css`. Use `cn()` from `lib/utils.ts` for conditional classes. Dark-first theme.
- **Type definitions**: centralized in `types/index.ts`
- **Toast notifications**: use `sonner` (`toast.error()`, `toast.success()`)
- **API error pattern**: try/catch returning `NextResponse.json(data, { status })` in route handlers

## Domain & Deployment

- Vercel deployment region: `sin1` (Singapore)
- Allowed dev origins: localhost, 127.0.0.1, 192.168.*.*, *.huggingface.co
- Image optimization configured for `avatars.githubusercontent.com` and `github.com`
- Dockerfile uses Node.js 20-alpine on port 3000
