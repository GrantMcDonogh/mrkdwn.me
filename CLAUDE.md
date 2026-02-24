# CLAUDE.md

## Project Overview

mrkdwn.me is a cloud-based Obsidian-inspired knowledge management app. React + TypeScript frontend, Convex backend, Clerk auth.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run dev:backend  # Start Convex dev backend
npm run build        # Type-check + Vite production build
npm run test         # Run vitest
npm run lint         # ESLint
```

## Deployment

Frontend and backend are deployed separately:

- **Frontend (Vercel):** `vercel --prod`
- **Backend (Convex):** `npx convex deploy --cmd 'echo done' -y`

Always deploy both when changes touch files in `convex/`. Frontend-only changes only need Vercel.

- Production URL: https://app.mrkdwn.me
- Convex prod deployment: `beaming-panda-407`
- Convex dev deployment: `dependable-snail-633`

## Architecture

- `src/` — React frontend (components, hooks, utils, store)
- `convex/` — Convex backend (queries, mutations, httpActions, schema)
- `mcp-server/` — MCP server for AI tool access to vaults
- `docs/` — Feature documentation

## Key Conventions

- Styling: Tailwind CSS 4 with custom `obsidian-*` theme tokens. Dark theme only.
- State: React Context + useReducer (`src/store/workspace.tsx`)
- Server state: Convex `useQuery` / `useMutation`
- HTTP endpoints: Convex httpActions in `convex/http.ts` with manual CORS headers
- Auth: Clerk JWTs validated via `ctx.auth.getUserIdentity()` in every backend function
- Avoid HTTP 502 status in Convex httpActions — Convex infrastructure intercepts it and strips custom headers (including CORS). Use 400 instead.
- OpenRouter model IDs use canonical names (e.g. `anthropic/claude-sonnet-4`), not date-suffixed versions.
