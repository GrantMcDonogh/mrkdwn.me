# Vault System

## Overview

Vaults are the top-level organizational unit in mrkdwn.me, mirroring the concept of vaults in the desktop Obsidian application. Each vault is an isolated workspace containing its own set of folders and notes. A user can create multiple vaults to separate different knowledge bases (e.g., "Work", "Personal", "Research").

## Data Model

### Schema (`convex/schema.ts`)

```typescript
vaults: defineTable({
  name: v.string(),
  userId: v.string(),
  createdAt: v.number(),
  settings: v.optional(v.any()),
}).index("by_user", ["userId"]),
```

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `Id<"vaults">` | Auto-generated primary key |
| `name` | `string` | Display name of the vault |
| `userId` | `string` | Clerk `tokenIdentifier` identifying the owning user |
| `createdAt` | `number` | Unix timestamp of creation |
| `settings` | `any` (optional) | Imported Obsidian settings (editor, appearance, graph). See [Import Vault](./import-vault.md) for shape details. |

### Index

- **`by_user`** (`[userId]`) — Enables efficient lookup of all vaults belonging to a user.

## API

### Queries

#### `vaults.list`

Lists all vaults owned by the authenticated user.

- **Auth**: Required
- **Parameters**: None
- **Returns**: Array of vault documents, queried via the `by_user` index
- **Usage**: Called by `VaultSelector` to display the vault list

#### `vaults.get`

Retrieves a single vault by ID with ownership verification.

- **Auth**: Required
- **Parameters**: `{ id: Id<"vaults"> }`
- **Returns**: Vault document
- **Throws**: If the vault does not exist or does not belong to the authenticated user

### Mutations

#### `vaults.create`

Creates a new vault for the authenticated user.

- **Auth**: Required
- **Parameters**: `{ name: string }`
- **Behavior**: Inserts a new vault with the current timestamp
- **Returns**: The new vault's `Id<"vaults">`

#### `vaults.rename`

Renames an existing vault.

- **Auth**: Required
- **Parameters**: `{ id: Id<"vaults">, name: string }`
- **Behavior**: Verifies ownership, then patches the vault name

#### `vaults.remove`

Deletes a vault and all of its contents.

- **Auth**: Required
- **Parameters**: `{ id: Id<"vaults"> }`
- **Behavior**:
  1. Verifies ownership
  2. Queries all notes in the vault → deletes each one
  3. Queries all folders in the vault → deletes each one
  4. Deletes the vault document itself
- **Cascade**: Full cascade deletion — no orphaned folders or notes remain

### Internal Mutations

#### `vaults.importCreateVault`

Creates a vault document without client-facing auth (called from the `importVault.createVaultWithFolders` action which already verified auth).

- **Type**: Internal mutation
- **Parameters**: `{ name: string, userId: string, settings?: any }`
- **Returns**: `Id<"vaults">`

## AI Onboarding Wizard

Users can generate a personalized starter vault via a guided AI wizard.

### Entry Point

A "Set Up with AI" button with a `Sparkles` icon appears in the `VaultSelector`, alongside "Create New Vault" and "Import Vault". Clicking it opens the `OnboardingWizardDialog`.

### Wizard Flow

**File:** `src/components/vault/OnboardingWizardDialog.tsx`

The dialog is a state machine with the following states:

| State | UI |
|---|---|
| `questions` | Chat-like interface — bot asks questions, user selects options |
| `generating` | Spinner + "Generating your personalized vault…" |
| `preview` | Editable vault name, folder/note counts, "Create Vault" button |
| `creating` | Progress spinner ("Creating vault and folders…" → "Creating notes (batch N of M)…") |
| `done` | Checkmark + auto-navigates to new vault after 1 second |
| `error` | Error message + "Try Again" button (resets to `questions`) |

### Questions

**File:** `src/lib/onboardingQuestions.ts`

| # | Question | Type | Options |
|---|----------|------|---------|
| 1 | Purpose | Single-select | Personal knowledge, Work, Academic/Research, Creative/Projects, General second brain |
| 2 | Topics | Multi-select (max 3) | Technology, Business, Science, Arts, Self-improvement, Mixed |
| 3 | Organization | Single-select | By topic, By project, Flat with links, Chronological |
| 4 | Starter Content | Single-select | Templates & examples, Pre-filled notes, Empty structure only, Full starter kit |

### Backend

**File:** `convex/onboarding.ts`

An HTTP action that calls the Claude API (`claude-sonnet-4-5-20250929`, max 8192 tokens) with a system prompt that instructs Claude to generate a vault structure (3–8 folders, 5–15 notes with `[[Wiki Link]]` syntax) as JSON.

**File:** `convex/http.ts` — registers `POST /api/onboarding` and `OPTIONS /api/onboarding` routes.

### Client Hook

**File:** `src/hooks/useOnboardingGenerate.ts`

Returns a `generate(answers)` function that calls the `/api/onboarding` endpoint with the user's answers and Clerk auth token. Returns a `GeneratedVault` object (`{ vaultName, folders, notes }`).

### Vault Creation

After generation, the wizard reuses the same import infrastructure:
1. Calls `createVaultWithFolders` action (creates vault + all folders server-side)
2. Maps temporary folder IDs to real database IDs
3. Uses `batchNotes()` to split notes into size-limited batches
4. Calls `notes.importBatch` mutation for each batch

### Response Parsing

**File:** `src/lib/onboardingParse.ts`

Utilities for extracting and validating the Claude API response:
- Strips markdown code fencing from responses
- Validates JSON structure (requires `vaultName`, `folders` array, `notes` array)

### Tests

**Files:** `src/lib/onboardingParse.test.ts` (36 tests), `src/lib/onboardingQuestions.test.ts` (12 tests)

### File Summary

| File | Purpose |
|---|---|
| `src/components/vault/OnboardingWizardDialog.tsx` | Wizard dialog UI (state machine) |
| `src/hooks/useOnboardingGenerate.ts` | Client hook for AI generation |
| `src/lib/onboardingQuestions.ts` | Question definitions |
| `src/lib/onboardingParse.ts` | Response parsing utilities |
| `convex/onboarding.ts` | Backend HTTP action (Claude API) |
| `convex/http.ts` | Route registration |
| `src/components/vault/VaultSelector.tsx` | Entry point button |

## Import Vault

Users can import existing Obsidian vaults from their local filesystem. The import flow reads all `.md` files and folder structure, parses applicable `.obsidian` settings, and creates everything in the database. See [Import Vault](./import-vault.md) for full details.

## Frontend

### Vault Selector

**File:** `src/components/vault/VaultSelector.tsx`

The vault selector is the first screen shown after authentication. It displays all of the user's vaults and allows creating, renaming, deleting, and selecting vaults.

#### UI Elements

| Element | Description |
|---------|-------------|
| Header | "Your Vaults" title with a "Sign Out" button (`LogOut` icon, calls `useClerk().signOut()`) |
| Vault List | Vertical stack of vault cards, each showing the vault name with hover-reveal action buttons (Pencil for rename, Download for export as ZIP, Trash2 for delete) |
| Create Button | Full-width dashed-border card with `Plus` icon and "Create New Vault" text |
| Import Button | Full-width dashed-border card with `Upload` icon and "Import Vault" text. Opens the Import Vault dialog. |
| AI Onboarding Button | Full-width dashed-border card with `Sparkles` icon and "Set Up with AI" text. Opens the AI Onboarding Wizard dialog. |
| Create Form | Inline form with text input, "Create" submit button, and "Cancel" button |
| Empty State | "No vaults yet. Create one to get started." message (shown when no vaults exist) |

#### Interactions

1. **Select Vault**: Clicking a vault card dispatches `SET_VAULT` action, which transitions the UI to the main `AppLayout`.
2. **Create Vault**: Clicking "Create New Vault" reveals an input field. Submitting calls `vaults.create` mutation.
3. **Rename Vault**: Double-clicking the Pencil icon on a vault card enables inline editing. On blur or Enter, calls `vaults.rename`. Pressing Escape cancels the rename without saving.
4. **Download Vault**: Clicking the Download icon fetches all folders and notes, builds a ZIP client-side using JSZip, and triggers a browser download of `{VaultName}.zip`. See [Download Vault](./download-vault.md) for the full flow.
5. **Delete Vault**: Clicking the Trash2 icon triggers a native `window.confirm()` dialog. On confirm, calls `vaults.remove`.
6. **Import Vault**: Clicking "Import Vault" opens `ImportVaultDialog`, a modal that guides the user through selecting a local Obsidian vault folder, previewing its contents, and importing all notes, folders, and settings. See [Import Vault](./import-vault.md) for the full flow.
7. **AI Onboarding**: Clicking "Set Up with AI" opens the `OnboardingWizardDialog`, a multi-step wizard that asks about the user's knowledge management goals and generates a personalized starter vault using Claude. See the AI Onboarding Wizard section above.

#### State Management

- The selected vault ID is stored in the workspace context (`vaultId` field).
- Dispatching `SET_VAULT` sets the vault and resets the entire workspace state (`...initialState`), including sidebar, right panel, search query, and split direction.
- Dispatching `LEAVE_VAULT` clears the vault and resets the entire workspace state, returning to the selector.

### Vault Navigation

- The sidebar header contains a **Vault Switcher** dropdown that lists all vaults. Clicking a different vault dispatches `SET_VAULT` to switch inline. A "Download Vault" option exports the current vault as a ZIP file. A "Manage Vaults..." option dispatches `LEAVE_VAULT` to return to the full-page vault selector.
- The command palette provides both a "Download Vault" command (exports the current vault as ZIP) and a "Manage Vaults" command that dispatches `LEAVE_VAULT`.
- Switching vaults clears all open tabs and panes, resetting the workspace state.

## Download / Export Vault

Users can download any vault as a `.zip` file containing all notes as `.md` files in the vault's folder hierarchy. The ZIP is built entirely client-side using JSZip — no backend changes are needed. See [Download Vault](./download-vault.md) for full details.

## Vault API Keys

Each vault can have multiple API keys for REST API and MCP server access. Keys are managed in Settings → Vault API Keys.

- **Vault-scoped**: Each key grants access to exactly one vault.
- **Hash-only storage**: Only the SHA-256 hash is stored in the `apiKeys` table.
- **One-time reveal**: The raw key is shown once at creation and cannot be retrieved.
- **Revocable**: Keys can be deleted immediately from the Settings UI.
- **Last used tracking**: Each key tracks when it was last used for an API request.

See [Authentication](./authentication.md#api-key-authentication-rest-api) for implementation details.

## Ownership & Access Control

- All vault operations verify that the requesting user owns the vault.
- There is no sharing mechanism — vaults are strictly single-user.
- The `by_user` index ensures only the owner's vaults are returned in queries.
- API keys provide scoped external access to a single vault without exposing other vaults.

## Cascade Deletion Behavior

When a vault is deleted:

```
Vault
 ├── Note 1      → deleted
 ├── Note 2      → deleted
 ├── Folder A    → deleted
 │   ├── Note 3  → deleted (via vault query, not folder cascade)
 │   └── Folder B→ deleted
 └── Note 4      → deleted
```

All notes and folders are queried by `vaultId` and deleted individually before the vault document itself is removed. This ensures no orphaned data remains.
