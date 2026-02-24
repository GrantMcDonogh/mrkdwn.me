import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

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
    return ctx.db
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
  },
});

export const createFolder = internalMutation({
  args: {
    name: v.string(),
    vaultId: v.id("vaults"),
    parentId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const siblings = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) =>
        q.eq("vaultId", args.vaultId).eq("parentId", args.parentId)
      )
      .collect();
    return ctx.db.insert("folders", {
      name: args.name,
      vaultId: args.vaultId,
      parentId: args.parentId,
      order: siblings.length,
    });
  },
});

export const renameFolder = internalMutation({
  args: { id: v.id("folders"), vaultId: v.id("vaults"), name: v.string() },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.vaultId !== args.vaultId) throw new Error("Folder not found");
    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const moveFolder = internalMutation({
  args: { id: v.id("folders"), vaultId: v.id("vaults"), parentId: v.optional(v.id("folders")) },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.vaultId !== args.vaultId) throw new Error("Folder not found");
    await ctx.db.patch(args.id, { parentId: args.parentId });
  },
});

export const removeFolder = internalMutation({
  args: { id: v.id("folders"), vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.vaultId !== args.vaultId) throw new Error("Folder not found");

    // Promote child folders to deleted folder's parent
    const childFolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) =>
        q.eq("vaultId", folder.vaultId).eq("parentId", args.id)
      )
      .collect();
    for (const child of childFolders) {
      await ctx.db.patch(child._id, { parentId: folder.parentId });
    }

    // Promote child notes to deleted folder's parent
    const childNotes = await ctx.db
      .query("notes")
      .withIndex("by_folder", (q) =>
        q.eq("vaultId", folder.vaultId).eq("folderId", args.id)
      )
      .collect();
    for (const note of childNotes) {
      await ctx.db.patch(note._id, { folderId: folder.parentId });
    }

    await ctx.db.delete(args.id);
  },
});

// --- Notes ---

export const listNotes = internalQuery({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
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
  },
  handler: async (ctx, args) => {
    const siblings = await ctx.db
      .query("notes")
      .withIndex("by_folder", (q) =>
        q.eq("vaultId", args.vaultId).eq("folderId", args.folderId)
      )
      .collect();
    const now = Date.now();
    return ctx.db.insert("notes", {
      title: args.title,
      content: "",
      vaultId: args.vaultId,
      folderId: args.folderId,
      order: siblings.length,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateNote = internalMutation({
  args: { id: v.id("notes"), vaultId: v.id("vaults"), content: v.string() },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");
    await ctx.db.patch(args.id, { content: args.content, updatedAt: Date.now() });
  },
});

export const renameNote = internalMutation({
  args: { id: v.id("notes"), vaultId: v.id("vaults"), title: v.string() },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");

    const oldTitle = note.title;
    const newTitle = args.title;

    await ctx.db.patch(args.id, { title: newTitle, updatedAt: Date.now() });

    // Propagate wiki link renames across all notes in the vault
    if (oldTitle !== newTitle) {
      const allNotes = await ctx.db
        .query("notes")
        .withIndex("by_vault", (q) => q.eq("vaultId", note.vaultId))
        .collect();
      for (const other of allNotes) {
        if (other._id === args.id) continue;
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
  },
});

export const moveNote = internalMutation({
  args: { id: v.id("notes"), vaultId: v.id("vaults"), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");
    await ctx.db.patch(args.id, { folderId: args.folderId });
  },
});

export const removeNote = internalMutation({
  args: { id: v.id("notes"), vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.vaultId !== args.vaultId) throw new Error("Note not found");
    await ctx.db.delete(args.id);
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
      if (!seen.has(note._id)) {
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
