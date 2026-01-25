# AGENTS.md - BuildFlow Development Guide

This document provides essential information for agentic coding agents working on the BuildFlow codebase.

## Project Overview
BuildFlow is a Next.js 15 application that enables AI-powered website generation. It uses GitHub for authentication and project storage, with IndexedDB for local-first data management and a React-based editor interface for building websites with AI assistance.

## Build & Development Commands

### Primary Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application with Turbopack  
- `npm run start` - Start production server

### Testing
- No test framework is currently configured in this codebase
- Manual testing required for all changes

## Technology Stack

### Core Framework
- **Next.js 15** with App Router
- **React 19.1.0** with TypeScript
- **Tailwind CSS 4.1.13** for styling

### Key Dependencies
- **UI Components**: Radix UI primitives with shadcn/ui components
- **State Management**: TanStack Query for server state
- **Authentication**: GitHub OAuth integration
- **AI Integration**: OpenAI, Google Gemini, DeepSeek (direct client APIs)
- **Editor**: Monaco Editor for code editing
- **Local Storage**: IndexedDB via idb library
- **GitHub API**: Octokit for repository management
- **Encryption**: crypto-js for API key encryption
- **Styling**: Tailwind CSS with custom theme variables

## Code Style Guidelines

### Import Organization
```typescript
// External libraries first
import { useQuery } from "@tanstack/react-query";
import { NextResponse } from "next/server";

// Internal imports with @ alias
import { User } from "@/types";
import { api } from "@/lib/api";
import { MyComponent } from "@/components/my-component";
```

### TypeScript Configuration
- **Strict mode enabled**
- **Path aliases**: `@/*` maps to project root
- **Component files**: Use `.tsx` for React components, `.ts` for utilities
- **Type definitions**: Located in `types/index.ts`

### Naming Conventions
- **Components**: PascalCase (e.g., `UserMenu`, `ProjectCard`)
- **Files**: kebab-case for folders (e.g., `user-menu/`, `my-projects/`)
- **Functions**: camelCase (e.g., `useUser`, `api.get`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_FREE_PROJECTS`)
- **CSS Variables**: kebab-case with semantic naming (e.g., `--color-primary`)

### Component Structure
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export const ComponentName = ({ prop }: ComponentProps) => {
  const [state, setState] = useState();

  return (
    <div className="className">
      {/* JSX content */}
    </div>
  );
};
```

## File Structure Patterns

### Directory Organization
```
/app/           # Next.js App Router pages and API routes
/components/    # React components organized by feature
/lib/           # Utility functions and configurations
/hooks/         # Custom React hooks
/types/         # TypeScript type definitions
/assets/        # Static assets and global CSS
/models/        # Database models
/public/        # Public static files
```

### Component Organization
- Feature components in own folders (e.g., `user-menu/index.tsx`)
- UI components in `components/ui/` (shadcn/ui pattern)
- Shared utilities in `lib/`
- Custom hooks in `hooks/`

## Error Handling

### API Routes
```typescript
export async function GET() {
  try {
    // API logic
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error message" }, 
      { status: 500 }
    );
  }
}
```

### Client-side
- Use `toast.error()` from Sonner for user notifications
- Implement proper try-catch blocks in async functions
- Use TanStack Query error handling for API calls

## CSS & Styling

### Tailwind Configuration
- **Base path**: `/buildflow` (configured in next.config.ts)
- **Theme**: Dark-first design with CSS custom properties
- **Components**: shadcn/ui with New York style variant
- **Icons**: Lucide React icon library

### Styling Patterns
- Use `cn()` utility from `lib/utils.ts` for conditional classes
- Follow dark theme conventions (black backgrounds, light text)
- Implement responsive design with Tailwind breakpoints
- Use CSS custom properties defined in `assets/globals.css`

## Development Patterns

### React Hooks
- Custom hooks in `hooks/` directory (e.g., `useUser`, `useEditor`)
- Use TanStack Query for server state management
- Implement proper dependency arrays in useEffect

### API Integration
- API client configured in `lib/api.ts`
- Authentication via Vercel OAuth tokens
- Error handling with toast notifications
- Type-safe API responses using TypeScript

### Authentication
- Vercel OAuth integration
- Token-based authentication with secure cookies
- User context provided via React Context API
- Proper token refresh and logout handling

## Environment & Configuration

### Next.js Configuration
- Turbopack enabled for development and build
- Base path and asset prefix set to `/buildflow`
- Webpack configuration for audio file handling
- Image optimization for Vercel domains

### TypeScript
- Strict mode enabled
- Path alias `@/*` configured
- Next.js types and plugin integration

## Special Considerations

### Iframe Detection
- Application detects if running in iframe
- OAuth flow adapted for iframe contexts (popup windows)
- Security measures for cross-origin scenarios

### Domain Restrictions
- Production deployment restricted to buildflow.vercel.app domains
- Local development allowed on localhost/192.168.x.x
- Automatic redirects to production domain

### Asset Handling
- Audio files processed with url-loader
- Image optimization configured for Vercel
- Static asset serving via Next.js

## Code Quality

### ESLint Configuration
- TypeScript rules enforced
- `@typescript-eslint/no-explicit-any` disabled where necessary
- Custom rules for Next.js and React patterns

### Best Practices
- Use proper TypeScript types (avoid `any` when possible)
- Implement proper error boundaries
- Follow React best practices for hooks and state management
- Use semantic HTML and accessibility features
- Implement proper loading states and error handling