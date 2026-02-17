# Vault System

## Overview

Vaults are the top-level organizational unit in Obsidian Online, mirroring the concept of vaults in the desktop Obsidian application. Each vault is an isolated workspace containing its own set of folders and notes. A user can create multiple vaults to separate different knowledge bases (e.g., "Work", "Personal", "Research").

## Data Model

### Schema (`convex/schema.ts`)

```typescript
vaults: defineTable({
  name: v.string(),
  userId: v.id("users"),
  createdAt: v.number(),
}).index("by_user", ["userId"]),
```

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `Id<"vaults">` | Auto-generated primary key |
| `name` | `string` | Display name of the vault |
| `userId` | `Id<"users">` | Owner of the vault |
| `createdAt` | `number` | Unix timestamp of creation |

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

## Frontend

### Vault Selector

**File:** `src/components/vault/VaultSelector.tsx`

The vault selector is the first screen shown after authentication. It displays all of the user's vaults and allows creating, renaming, deleting, and selecting vaults.

#### UI Elements

| Element | Description |
|---------|-------------|
| Header | "Your Vaults" title with a "Sign Out" button |
| Vault List | Grid of vault cards, each showing the vault name |
| Create Button | "Create New Vault" button below the list |
| Create Form | Inline input field that appears when creating a new vault |

#### Interactions

1. **Select Vault**: Clicking a vault card dispatches `SET_VAULT` action, which transitions the UI to the main `AppLayout`.
2. **Create Vault**: Clicking "Create New Vault" reveals an input field. Submitting calls `vaults.create` mutation.
3. **Rename Vault**: Clicking the rename icon on a vault card enables inline editing. On blur or Enter, calls `vaults.rename`.
4. **Delete Vault**: Clicking the trash icon triggers a confirmation. On confirm, calls `vaults.remove`.

#### State Management

- The selected vault ID is stored in the workspace context (`vaultId` field).
- Dispatching `SET_VAULT` sets the vault and transitions to the app layout.
- Dispatching `LEAVE_VAULT` clears the vault and returns to the selector.

### Vault Navigation

- From within the app layout, users can return to the vault selector via the command palette ("Switch Vault" command) or a dedicated UI action.
- Switching vaults clears all open tabs and panes, resetting the workspace state.

## Ownership & Access Control

- All vault operations verify that the requesting user owns the vault.
- There is no sharing mechanism — vaults are strictly single-user.
- The `by_user` index ensures only the owner's vaults are returned in queries.

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
