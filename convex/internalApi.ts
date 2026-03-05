import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { logAudit } from "./auditLog";
import { maybeCreateSnapshot } from "./noteVersions";

// Auth-free internal functions called by httpActions after API key validation.
// Each validates the resource belongs to the given vault (defense-in-depth).

// --- Vault ---

export const getVault = internalQuery({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const vault = await ctx.db.get(args.vaultId);
    if (!vault) throw new Error("Vault not found");
    return { name: vault.name, createdAt: vault.createdAt };
  },
});

// --- Folders ---

export const listFolders = internalQuery({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    return all.filter((f) => f.isDeleted !== true);
  },
});

export const createFolder = internalMutation({
  args: {
    name: v.string(),
    vaultId: v.id("vaults"),
    parentId: v.optional(v.id("folders")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const siblings = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) =>
        q.eq("vaultId", args.vaultId).eq("parentId", args.parentId)
      )
      .collect();
    const id = await ctx.db.insert("folders", {
      name: args.name,
      vaultId: args.vaultId,
      parentId: args.parentId,
      order: siblings.filter((f) => f.isDeleted !== true).length,
    });
    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId: args.userId ?? "api",
      action: "create",
      targetType: "folder",
      targetId: id,
      targetName: args.name,
    });
    return id;
  },
});

export const renameFolder = internalMutation({
  args: { id: v.id("folders"), vaultId: v.id("vaults"), name: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.vaultId !== args.vaultId) throw new Error("Folder not found");
    const oldName = folder.name;
    await ctx.db.patch(args.id, { name: args.name });
    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId: args.userId ?? "api",
      action: "rename",
      targetType: "folder",
      targetId: args.id,
      targetName: args.name,
      metadata: { oldName, newName: args.name },
    });
  },
});

export const moveFolder = internalMutation({
  args: { id: v.id("folders"), vaultId: v.id("vaults"), parentId: v.optional(v.id("folders")), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.vaultId !== args.vaultId) throw new Error("Folder not found");
    const fromParent = folder.parentId ?? null;
    await ctx.db.patch(args.id, { parentId: args.parentId });
    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId: args.userId ?? "api",
      action: "move",
      targetType: "folder",
      targetId: args.id,
      targetName: folder.name,
      metadata: { fromParent, toParent: args.parentId ?? null },
    });
  },
});

export const removeFolder = internalMutation({
  args: { id: v.id("folders"), vaultId: v.id("vaults"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.vaultId !== args.vaultId) throw new Error("Folder not found");

    const now = Date.now();
    const actorId = args.userId ?? "api";

    // Collect all descendant folder IDs recursively
    async function getDescendantFolderIds(parentId: Id<"folders">): Promise<Id<"folders">[]> {
      const children = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q) =>
          q.eq("vaultId", args.vaultId).eq("parentId", parentId)
        )
        .collect();
      const activeChildren = children.filter((f) => f.isDeleted !== true);
      const ids: Id<"folders">[] = [];
      for (const child of activeChildren) {
        ids.push(child._id);
        const grandChildren = await getDescendantFolderIds(child._id);
        ids.push(...grandChildren);
      }
      return ids;
    }

    const descendantIds = await getDescendantFolderIds(args.id);
    const allFolderIds = [args.id, ...descendantIds];

    // Soft delete all folders
    for (const folderId of allFolderIds) {
      await ctx.db.patch(folderId, {
        isDeleted: true,
        deletedAt: now,
        deletedBy: actorId,
      });
    }

    // Soft delete all notes in these folders
    for (const folderId of allFolderIds) {
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_folder", (q) =>
          q.eq("vaultId", args.vaultId).eq("folderId", folderId)
        )
        .collect();
      for (const note of notes) {
        if (note.isDeleted === true) continue;
        await maybeCreateSnapshot(ctx.db, {
          noteId: note._id,
          vaultId: args.vaultId,
          userId: actorId,
          trigger: "delete",
        });
        await ctx.db.patch(note._id, {
          isDeleted: true,
          deletedAt: now,
          deletedBy: actorId,
        });
      }
    }

    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId: actorId,
      action: "delete",
      targetType: "folder",
      targetId: args.id,
      targetName: folder.name,
    });
  },
});

// --- Notes ---

export const listNotes = internalQuery({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    return all.filter((n) => n.isDeleted !== true);
  },
});

export const getNote = internalQuery({
  args: { id: v.id("notes"), vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");
    return note;
  },
});

export const createNote = internalMutation({
  args: {
    title: v.string(),
    vaultId: v.id("vaults"),
    folderId: v.optional(v.id("folders")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const siblings = await ctx.db
      .query("notes")
      .withIndex("by_folder", (q) =>
        q.eq("vaultId", args.vaultId).eq("folderId", args.folderId)
      )
      .collect();
    const now = Date.now();
    const id = await ctx.db.insert("notes", {
      title: args.title,
      content: "",
      vaultId: args.vaultId,
      folderId: args.folderId,
      order: siblings.filter((n) => n.isDeleted !== true).length,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId: args.userId ?? "api",
      action: "create",
      targetType: "note",
      targetId: id,
      targetName: args.title,
    });
    return id;
  },
});

export const updateNote = internalMutation({
  args: { id: v.id("notes"), vaultId: v.id("vaults"), content: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");
    const actorId = args.userId ?? "api";
    await maybeCreateSnapshot(ctx.db, {
      noteId: args.id,
      vaultId: args.vaultId,
      userId: actorId,
      trigger: "auto",
    });
    await ctx.db.patch(args.id, { content: args.content, updatedAt: Date.now(), updatedBy: actorId });
    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId: actorId,
      action: "update",
      targetType: "note",
      targetId: args.id,
      targetName: note.title,
    });
  },
});

export const renameNote = internalMutation({
  args: { id: v.id("notes"), vaultId: v.id("vaults"), title: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");

    const oldTitle = note.title;
    const newTitle = args.title;
    const actorId = args.userId ?? "api";

    await maybeCreateSnapshot(ctx.db, {
      noteId: args.id,
      vaultId: args.vaultId,
      userId: actorId,
      trigger: "rename",
    });

    await ctx.db.patch(args.id, { title: newTitle, updatedAt: Date.now() });

    // Propagate wiki link renames across all notes in the vault
    if (oldTitle !== newTitle) {
      const allNotes = await ctx.db
        .query("notes")
        .withIndex("by_vault", (q) => q.eq("vaultId", note.vaultId))
        .collect();
      for (const other of allNotes) {
        if (other._id === args.id) continue;
        if (other.isDeleted === true) continue;
        let content = other.content;
        let changed = false;
        const patterns = [
          { find: `[[${oldTitle}]]`, replace: `[[${newTitle}]]` },
          { find: `[[${oldTitle}|`, replace: `[[${newTitle}|` },
          { find: `[[${oldTitle}#`, replace: `[[${newTitle}#` },
        ];
        for (const { find, replace } of patterns) {
          if (content.includes(find)) {
            content = content.split(find).join(replace);
            changed = true;
          }
        }
        if (changed) {
          await ctx.db.patch(other._id, { content, updatedAt: Date.now() });
        }
      }
    }

    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId: actorId,
      action: "rename",
      targetType: "note",
      targetId: args.id,
      targetName: newTitle,
      metadata: { oldTitle, newTitle },
    });
  },
});

export const moveNote = internalMutation({
  args: { id: v.id("notes"), vaultId: v.id("vaults"), folderId: v.optional(v.id("folders")), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");
    const actorId = args.userId ?? "api";
    const fromFolder = note.folderId ?? null;
    await maybeCreateSnapshot(ctx.db, {
      noteId: args.id,
      vaultId: args.vaultId,
      userId: actorId,
      trigger: "move",
    });
    await ctx.db.patch(args.id, { folderId: args.folderId });
    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId: actorId,
      action: "move",
      targetType: "note",
      targetId: args.id,
      targetName: note.title,
      metadata: { fromFolder, toFolder: args.folderId ?? null },
    });
  },
});

export const removeNote = internalMutation({
  args: { id: v.id("notes"), vaultId: v.id("vaults"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");
    const actorId = args.userId ?? "api";
    await maybeCreateSnapshot(ctx.db, {
      noteId: args.id,
      vaultId: args.vaultId,
      userId: actorId,
      trigger: "delete",
    });
    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: actorId,
    });
    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId: actorId,
      action: "delete",
      targetType: "note",
      targetId: args.id,
      targetName: note.title,
    });
  },
});

export const searchNotes = internalQuery({
  args: { vaultId: v.id("vaults"), query: v.string() },
  handler: async (ctx, args) => {
    if (!args.query.trim()) return [];

    const titleResults = await ctx.db
      .query("notes")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("vaultId", args.vaultId)
      )
      .take(20);

    const contentResults = await ctx.db
      .query("notes")
      .withSearchIndex("search_content", (q) =>
        q.search("content", args.query).eq("vaultId", args.vaultId)
      )
      .take(20);

    const seen = new Set<string>();
    const results = [];
    for (const note of [...titleResults, ...contentResults]) {
      if (!seen.has(note._id) && note.isDeleted !== true) {
        seen.add(note._id);
        results.push(note);
      }
    }
    return results.slice(0, 20);
  },
});

export const getBacklinks = internalQuery({
  args: { noteId: v.id("notes"), vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");

    const allNotes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", note.vaultId))
      .collect();

    const backlinks: { noteId: Id<"notes">; noteTitle: string; context: string }[] = [];
    for (const other of allNotes) {
      if (other._id === args.noteId) continue;
      if (other.isDeleted === true) continue;
      if (
        other.content.includes(`[[${note.title}]]`) ||
        other.content.includes(`[[${note.title}|`) ||
        other.content.includes(`[[${note.title}#`)
      ) {
        const lines = other.content.split("\n");
        const contextLine = lines.find(
          (l) =>
            l.includes(`[[${note.title}]]`) ||
            l.includes(`[[${note.title}|`) ||
            l.includes(`[[${note.title}#`)
        );
        backlinks.push({
          noteId: other._id,
          noteTitle: other.title,
          context: contextLine ?? "",
        });
      }
    }
    return backlinks;
  },
});

export const getUnlinkedMentions = internalQuery({
  args: { noteId: v.id("notes"), vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");

    if (!note.title) return [];

    const allNotes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", note.vaultId))
      .collect();

    const mentions: { noteId: Id<"notes">; noteTitle: string; context: string }[] = [];
    const titleLower = note.title.toLowerCase();

    for (const other of allNotes) {
      if (other._id === args.noteId) continue;
      if (other.isDeleted === true) continue;
      const contentLower = other.content.toLowerCase();
      if (!contentLower.includes(titleLower)) continue;

      const lines = other.content.split("\n");
      for (const line of lines) {
        const lineLower = line.toLowerCase();
        if (!lineLower.includes(titleLower)) continue;
        const idx = lineLower.indexOf(titleLower);
        const before = line.substring(0, idx);
        if (before.lastIndexOf("[[") > before.lastIndexOf("]]")) continue;
        mentions.push({
          noteId: other._id,
          noteTitle: other.title,
          context: line.trim(),
        });
        break;
      }
    }
    return mentions;
  },
});
