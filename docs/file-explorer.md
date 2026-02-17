# File Explorer

## Overview

The File Explorer is a tree-view sidebar component that displays the hierarchical structure of folders and notes within the active vault. Users can create, rename, delete, and reorganize folders and notes through this panel. It closely mirrors the file explorer found in the desktop Obsidian application.

## Data Models

### Folders (`convex/schema.ts`)

```typescript
folders: defineTable({
  name: v.string(),
  parentId: v.optional(v.id("folders")),
  vaultId: v.id("vaults"),
  order: v.number(),
})
  .index("by_vault", ["vaultId"])
  .index("by_parent", ["vaultId", "parentId"]),
```

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `Id<"folders">` | Auto-generated primary key |
| `name` | `string` | Folder display name |
| `parentId` | `Id<"folders">` or `undefined` | Parent folder (`undefined` = root level) |
| `vaultId` | `Id<"vaults">` | Owning vault |
| `order` | `number` | Sort position among siblings |

### Notes (folder-related fields)

| Field | Type | Description |
|-------|------|-------------|
| `folderId` | `Id<"folders">` or `undefined` | Containing folder (`undefined` = root level) |
| `order` | `number` | Sort position among siblings |

## Folder API

### Queries

#### `folders.list(vaultId)`

Returns all folders in a vault. The frontend builds the tree structure client-side using `parentId` relationships.

### Mutations

#### `folders.create(name, vaultId, parentId?)`

Creates a new folder. If `parentId` is provided, the folder is nested inside another folder; otherwise, it is placed at the root level. The `order` field is set based on the count of existing siblings.

#### `folders.rename(id, name)`

Renames a folder.

#### `folders.move(id, parentId?)`

Moves a folder to a new parent. Setting `parentId` to `undefined` moves the folder to the root level.

#### `folders.remove(id)`

Deletes a folder. Child notes and folders within the deleted folder are **promoted** to the deleted folder's parent (i.e., they are moved up one level, not deleted).

## Frontend Component

**File:** `src/components/explorer/FileExplorer.tsx`

### Tree Building

The component receives flat lists of folders and notes from Convex queries, then builds a recursive tree structure:

1. **Root items**: Folders with no `parentId` and notes with no `folderId`.
2. **Nesting**: Each folder's children are discovered by filtering for items whose `parentId`/`folderId` matches the folder's `_id`.
3. **Sorting**: Items are sorted by `order` field, with folders appearing before notes at each level.

### UI Structure

```
File Explorer Panel
├── Header: "Explorer" label + action buttons
│   ├── [+] Create Note (at root)
│   └── [📁+] Create Folder (at root)
├── Tree View (scrollable)
│   ├── 📁 Folder A (clickable to expand/collapse)
│   │   ├── 📄 Note 1 (clickable to open)
│   │   ├── 📄 Note 2
│   │   └── 📁 Subfolder
│   │       └── 📄 Note 3
│   ├── 📄 Root Note 1
│   └── 📄 Root Note 2
└── (Empty state message if no items)
```

### Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| **Expand / Collapse Folder** | Click folder row | Toggles `expandedFolders` set; shows/hides children |
| **Open Note** | Click note row | Dispatches `OPEN_NOTE` to workspace context |
| **Create Note** | Click `+` button on header or folder hover | Calls `notes.create` mutation, then opens the new note |
| **Create Folder** | Click folder+ button on header or folder hover | Calls `folders.create` mutation |
| **Rename** | Double-click item name | Switches to inline edit mode; save on Enter or blur |
| **Delete Note** | Click trash icon (visible on hover) | Calls `notes.remove` mutation |
| **Delete Folder** | Click trash icon (visible on hover) | Calls `folders.remove` mutation; children promoted |
| **Move (Drag & Drop)** | Drag item to a folder | Calls `notes.move` or `folders.move` mutation |

### Inline Editing

When renaming a folder or note:

1. An `<input>` replaces the name text.
2. The input is auto-focused and pre-filled with the current name.
3. Pressing **Enter** or clicking outside saves the new name.
4. Pressing **Escape** cancels the edit.
5. For notes, renaming also triggers wiki link reference updates (see [wiki-links-and-backlinks.md](./wiki-links-and-backlinks.md)).

### State

- **`expandedFolders`**: A `Set<string>` tracking which folder IDs are currently expanded. Managed with local `useState`.
- **`editingId`** and **`editingName`**: Track which item is being renamed inline.
- **`creatingIn`**: Tracks the parent folder ID when creating a new item.

### Drag & Drop

- Items can be dragged and dropped onto folders to reorganize the tree.
- Drop targets are visually indicated with a highlight.
- Dropping a note onto a folder calls `notes.move(noteId, folderId)`.
- Dropping a folder onto another folder calls `folders.move(folderId, newParentId)`.

### Visual Design

- Indentation per nesting level (left padding increases with depth).
- Folder icons: `ChevronRight` (collapsed) / `ChevronDown` (expanded) + `Folder` / `FolderOpen`.
- Note icons: `FileText` from lucide-react.
- Hover state reveals action buttons (create, rename, delete).
- Active/selected note is highlighted with the accent background color.
- Text truncation with ellipsis for long names.
