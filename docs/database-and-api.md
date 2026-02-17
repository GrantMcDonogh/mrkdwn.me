# Database & API

## Overview

mrkdwn.me uses [Convex](https://convex.dev) as its backend platform, providing a serverless document database, server-side functions (queries and mutations), real-time subscriptions, and authentication. The database schema is defined in `convex/schema.ts`, and all API functions are defined in the `convex/` directory.

## Database Schema

**File:** `convex/schema.ts`

### Entity Relationship Diagram

```
┌──────────────┐
│    users     │  (managed by @convex-dev/auth)
│──────────────│
│ _id          │
│ name?        │
│ email?       │
│ image?       │
│ ...          │
└──────┬───────┘
       │ 1
       │
       │ *
┌──────▼───────┐
│    vaults    │
│──────────────│
│ _id          │
│ name         │
│ userId ──────┼──→ users._id
│ createdAt    │
│ idx: by_user │
└──────┬───────┘
       │ 1
       │
   ┌───┴────────────────┐
   │ *                  │ *
┌──▼───────────┐  ┌─────▼────────┐
│   folders    │  │    notes     │
│──────────────│  │──────────────│
│ _id          │  │ _id          │
│ name         │  │ title        │
│ parentId ────┼──┐ content      │
│ vaultId ─────┼──┼→ folderId ───┼──→ folders._id (optional)
│ order        │  │ vaultId ─────┼──→ vaults._id
│ idx: by_vault│  │ order        │
│ idx: by_parent│ │ createdAt    │
└──────────────┘  │ updatedAt    │
       ▲          │ idx: by_vault│
       │          │ idx: by_folder│
       └──────────┤ search: content│
    (self-ref     │ search: title │
     parentId)    └──────────────┘
```

### Tables

#### `users`

Managed automatically by `@convex-dev/auth`. Includes auth-related tables (`authSessions`, `authAccounts`, etc.) via `authTables`.

#### `vaults`

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `Id<"vaults">` | Primary key (auto-generated) |
| `name` | `v.string()` | Vault display name |
| `userId` | `v.id("users")` | Foreign key to owning user |
| `createdAt` | `v.number()` | Creation timestamp (ms since epoch) |

**Indexes:**
- `by_user` → `["userId"]` — Lookup vaults by owner

#### `folders`

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `Id<"folders">` | Primary key |
| `name` | `v.string()` | Folder name |
| `parentId` | `v.optional(v.id("folders"))` | Parent folder (undefined = root) |
| `vaultId` | `v.id("vaults")` | Foreign key to vault |
| `order` | `v.number()` | Sort order among siblings |

**Indexes:**
- `by_vault` → `["vaultId"]` — All folders in a vault
- `by_parent` → `["vaultId", "parentId"]` — Folders within a specific parent

#### `notes`

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `Id<"notes">` | Primary key |
| `title` | `v.string()` | Note title |
| `content` | `v.string()` | Markdown content |
| `folderId` | `v.optional(v.id("folders"))` | Containing folder (undefined = root) |
| `vaultId` | `v.id("vaults")` | Foreign key to vault |
| `order` | `v.number()` | Sort order among siblings |
| `createdAt` | `v.number()` | Creation timestamp |
| `updatedAt` | `v.number()` | Last modification timestamp |

**Indexes:**
- `by_vault` → `["vaultId"]` — All notes in a vault
- `by_folder` → `["vaultId", "folderId"]` — Notes within a specific folder

**Search Indexes:**
- `search_content` → `{ searchField: "content" }` — Full-text search on note content
- `search_title` → `{ searchField: "title" }` — Full-text search on note title

---

## API Reference

### Vault Operations

**File:** `convex/vaults.ts`

| Function | Type | Parameters | Returns | Description |
|----------|------|-----------|---------|-------------|
| `vaults.list` | Query | — | `Vault[]` | List user's vaults |
| `vaults.get` | Query | `{ id }` | `Vault` | Get vault (with ownership check) |
| `vaults.create` | Mutation | `{ name }` | `Id<"vaults">` | Create vault |
| `vaults.rename` | Mutation | `{ id, name }` | — | Rename vault |
| `vaults.remove` | Mutation | `{ id }` | — | Delete vault + all contents |

### Folder Operations

**File:** `convex/folders.ts`

| Function | Type | Parameters | Returns | Description |
|----------|------|-----------|---------|-------------|
| `folders.list` | Query | `{ vaultId }` | `Folder[]` | List vault's folders |
| `folders.create` | Mutation | `{ name, vaultId, parentId? }` | `Id<"folders">` | Create folder |
| `folders.rename` | Mutation | `{ id, name }` | — | Rename folder |
| `folders.move` | Mutation | `{ id, parentId? }` | — | Move folder to new parent |
| `folders.remove` | Mutation | `{ id }` | — | Delete folder (children promoted) |

### Note Operations

**File:** `convex/notes.ts`

| Function | Type | Parameters | Returns | Description |
|----------|------|-----------|---------|-------------|
| `notes.list` | Query | `{ vaultId }` | `Note[]` | List vault's notes |
| `notes.get` | Query | `{ id }` | `Note` | Get single note |
| `notes.create` | Mutation | `{ title, vaultId, folderId? }` | `Id<"notes">` | Create note |
| `notes.update` | Mutation | `{ id, content }` | — | Update note content |
| `notes.rename` | Mutation | `{ id, title }` | — | Rename note + update wiki link references |
| `notes.move` | Mutation | `{ id, folderId? }` | — | Move note to folder |
| `notes.remove` | Mutation | `{ id }` | — | Delete note |
| `notes.search` | Query | `{ vaultId, query }` | `Note[]` | Full-text search (max 20 results) |
| `notes.getBacklinks` | Query | `{ noteId }` | `Backlink[]` | Get notes linking to this note |
| `notes.getUnlinkedMentions` | Query | `{ noteId }` | `Mention[]` | Get unlinked title mentions |

### Authentication

**File:** `convex/auth.ts`

| Export | Type | Description |
|--------|------|-------------|
| `auth` | Object | Session verification for queries/mutations |
| `signIn` | Action | Sign in/up action |
| `signOut` | Action | Sign out action |
| `store` | Object | Auth data store |

### HTTP Routes

**File:** `convex/http.ts`

| Route | Purpose |
|-------|---------|
| Auth callback routes | OAuth redirect handling (auto-registered by `auth.addHttpRoutes`) |

---

## Authorization Pattern

Every query and mutation follows the same authorization pattern:

```typescript
export const someFunction = query({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // For vault operations: verify vault ownership
    const vault = await ctx.db.get(args.vaultId);
    if (!vault || vault.userId !== userId) {
      throw new Error("Vault not found");
    }

    // ... proceed with operation
  },
});
```

- **Authentication**: Every function checks for a valid user session.
- **Authorization**: Vault operations verify that the requesting user owns the vault.
- **Data isolation**: Queries are scoped by `userId` (vaults) or `vaultId` (folders/notes).

---

## Query Patterns

### Indexed Queries

```typescript
// Efficient: uses by_user index
ctx.db.query("vaults").withIndex("by_user", q => q.eq("userId", userId)).collect();

// Efficient: uses by_vault index
ctx.db.query("notes").withIndex("by_vault", q => q.eq("vaultId", vaultId)).collect();

// Efficient: uses by_parent index
ctx.db.query("folders").withIndex("by_parent", q =>
  q.eq("vaultId", vaultId).eq("parentId", parentId)
).collect();
```

### Search Queries

```typescript
// Full-text search on content
ctx.db.query("notes")
  .withSearchIndex("search_content", q =>
    q.search("content", query).eq("vaultId", vaultId)
  )
  .take(20);

// Full-text search on title
ctx.db.query("notes")
  .withSearchIndex("search_title", q =>
    q.search("title", query).eq("vaultId", vaultId)
  )
  .take(20);
```

---

## Real-Time Subscriptions

Convex queries are automatically reactive. When the underlying data changes:

1. The Convex backend detects which queries are affected.
2. Updated results are pushed to subscribed clients over a persistent connection.
3. React components using `useQuery()` re-render with new data.

This means:
- The file explorer updates instantly when a note/folder is created or deleted.
- The graph view recomputes when links change.
- The backlinks panel refreshes when references are added or removed.
- Search results update as notes are modified.

No manual polling or refresh logic is needed.

---

## Mutation Side Effects

### `notes.rename` — Wiki Link Propagation

When a note is renamed, the mutation scans all notes in the vault and updates wiki link references:

```
For each note in vault:
  Replace [[oldTitle]] → [[newTitle]]
  Replace [[oldTitle| → [[newTitle|
  Replace [[oldTitle# → [[newTitle#
```

### `vaults.remove` — Cascade Deletion

```
Delete all notes where vaultId = vault._id
Delete all folders where vaultId = vault._id
Delete the vault document
```

### `folders.remove` — Child Promotion

```
Move child folders: set parentId = deletedFolder.parentId
Move child notes: set folderId = deletedFolder.parentId (mapped to folderId)
Delete the folder document
```
