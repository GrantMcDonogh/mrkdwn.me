import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function verifyVaultOwnership(
  ctx: { db: { get: (id: any) => Promise<any> } },
  vaultId: any,
  userId: any
) {
  const vault = await ctx.db.get(vaultId);
  if (!vault || vault.userId !== userId) {
    throw new Error("Vault not found");
  }
}

export const list = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    await verifyVaultOwnership(ctx, args.vaultId, userId);
    return ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    await verifyVaultOwnership(ctx, note.vaultId, userId);
    return note;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    vaultId: v.id("vaults"),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    await verifyVaultOwnership(ctx, args.vaultId, userId);
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

export const update = mutation({
  args: { id: v.id("notes"), content: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    await verifyVaultOwnership(ctx, note.vaultId, userId);
    await ctx.db.patch(args.id, { content: args.content, updatedAt: Date.now() });
  },
});

export const rename = mutation({
  args: { id: v.id("notes"), title: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    await verifyVaultOwnership(ctx, note.vaultId, userId);

    const oldTitle = note.title;
    const newTitle = args.title;

    // Update the note title
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
        // Replace [[OldTitle]] → [[NewTitle]]
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

export const move = mutation({
  args: { id: v.id("notes"), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    await verifyVaultOwnership(ctx, note.vaultId, userId);
    await ctx.db.patch(args.id, { folderId: args.folderId });
  },
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    await verifyVaultOwnership(ctx, note.vaultId, userId);
    await ctx.db.delete(args.id);
  },
});

export const search = query({
  args: { vaultId: v.id("vaults"), query: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    await verifyVaultOwnership(ctx, args.vaultId, userId);

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

    // Merge and deduplicate
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

export const getBacklinks = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    await verifyVaultOwnership(ctx, note.vaultId, userId);

    const allNotes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", note.vaultId))
      .collect();

    const backlinks: { noteId: typeof note._id; noteTitle: string; context: string }[] = [];
    for (const other of allNotes) {
      if (other._id === args.noteId) continue;
      if (
        other.content.includes(`[[${note.title}]]`) ||
        other.content.includes(`[[${note.title}|`) ||
        other.content.includes(`[[${note.title}#`)
      ) {
        // Extract context line
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

export const getUnlinkedMentions = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    await verifyVaultOwnership(ctx, note.vaultId, userId);

    if (!note.title) return [];

    const allNotes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", note.vaultId))
      .collect();

    const mentions: { noteId: typeof note._id; noteTitle: string; context: string }[] = [];
    const titleLower = note.title.toLowerCase();

    for (const other of allNotes) {
      if (other._id === args.noteId) continue;
      const contentLower = other.content.toLowerCase();
      if (!contentLower.includes(titleLower)) continue;

      // Check it's not already inside [[ ]]
      const lines = other.content.split("\n");
      for (const line of lines) {
        const lineLower = line.toLowerCase();
        if (!lineLower.includes(titleLower)) continue;
        // Simple check: if the title appears outside of [[ ]]
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
