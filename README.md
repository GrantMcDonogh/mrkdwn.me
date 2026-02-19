# mrkdwn.me

A cloud-based knowledge management app inspired by [Obsidian](https://obsidian.md). Create, organize, and interlink Markdown notes in real time with wiki-style linking, graph visualization, full-text search, AI chat, and more.

## Features

- **Markdown editor** — CodeMirror 6 with live preview, syntax highlighting, and edit/preview toggle
- **Wiki links** — `[[Note Title]]` syntax with autocomplete, aliases, and heading anchors
- **Graph view** — D3.js force-directed visualization of note relationships
- **Backlinks** — See every note that links to the current one
- **Full-text search** — Indexed search across note titles and content
- **Command palette & quick switcher** — `Ctrl+P` / `Ctrl+O` for fast navigation
- **Split panes & tabs** — Open multiple notes side-by-side
- **File explorer** — Hierarchical folder tree with drag-and-drop
- **AI chat** — Ask questions about your vault, powered by Claude with RAG context
- **Vault import/export** — Import from Obsidian (ZIP), upload `.md` files into existing vaults, and export your vault as ZIP
- **PDF export** — Export individual notes as styled PDF documents
- **AI onboarding** — Guided wizard to generate a starter vault
- **MCP server** — Model Context Protocol server for AI tool integrations
- **Real-time sync** — All changes sync instantly via Convex subscriptions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4 |
| Backend & Database | Convex |
| Authentication | Clerk |
| Editor | CodeMirror 6 |
| Graph | D3.js |
| AI | Claude API (Anthropic) |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Convex](https://www.convex.dev/) account
- A [Clerk](https://clerk.com/) account
- An [Anthropic](https://www.anthropic.com/) API key (for AI chat)

### Installation

```bash
git clone https://github.com/your-username/mrkdwn.me.git
cd mrkdwn.me
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
CONVEX_DEPLOYMENT=<your-convex-deployment>
VITE_CONVEX_URL=<your-convex-url>
VITE_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
```

Set these in the Convex dashboard under environment variables:

```
CLERK_JWT_ISSUER_DOMAIN=<your-clerk-jwt-issuer-domain>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

### Development

```bash
# Start the frontend dev server
npm run dev

# Start the Convex backend (separate terminal)
npm run dev:backend
```

### Build

```bash
npm run build
```

### Testing

```bash
npm run test
```

## Project Structure

```
mrkdwn-me/
├── src/                      # Frontend source
│   ├── components/
│   │   ├── auth/             # Clerk sign-in UI
│   │   ├── backlinks/        # Backlinks panel
│   │   ├── chat/             # AI chat panel
│   │   ├── command-palette/  # Command palette & quick switcher
│   │   ├── editor/           # Markdown editor, preview, wiki links
│   │   ├── explorer/         # File tree explorer
│   │   ├── graph/            # D3 graph visualization
│   │   ├── layout/           # App layout, sidebar, split panes, tabs
│   │   ├── search/           # Search panel
│   │   └── vault/            # Vault selection & management
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities (import, wikilinks, onboarding)
│   ├── store/                # Global state (Context + useReducer)
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Helpers (vault export)
├── convex/                   # Backend serverless functions
│   ├── schema.ts             # Database schema
│   ├── vaults.ts             # Vault CRUD
│   ├── folders.ts            # Folder management
│   ├── notes.ts              # Note CRUD, search, backlinks
│   ├── chat.ts               # AI chat HTTP action
│   ├── http.ts               # HTTP routes
│   └── auth.config.ts        # Clerk JWT config
├── mcp-server/               # MCP server for AI tool access
├── docs/                     # Feature documentation
└── public/                   # Static assets
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Command palette |
| `Ctrl+O` | Quick switcher (open note) |
| `Ctrl+E` | Toggle edit/preview mode |

## Documentation

Detailed docs for each feature are in the [`docs/`](./docs) directory:

- [Project Overview](./docs/project-overview.md)
- [Authentication](./docs/authentication.md)
- [Vault System](./docs/vault-system.md)
- [File Explorer](./docs/file-explorer.md)
- [Markdown Editor](./docs/markdown-editor.md)
- [Wiki Links & Backlinks](./docs/wiki-links-and-backlinks.md)
- [Graph View](./docs/graph-view.md)
- [Search & Command Palette](./docs/search-and-command-palette.md)
- [Workspace & Layout](./docs/workspace-and-layout.md)
- [Database & API](./docs/database-and-api.md)
- [Real-Time & Sync](./docs/real-time-and-sync.md)
- [AI Chat (RAG)](./docs/rag-chat.md)
- [Import Vault & Upload](./docs/import-vault.md)
- [Download, Export & PDF](./docs/download-vault.md)
- [Design & Styling](./docs/design-and-styling.md)
- [MCP Server](./docs/mcp-server.md)

## License

All rights reserved.
