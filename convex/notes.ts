import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyVaultAccess } from "./auth";
import { logAudit } from "./auditLog";
import { maybeCreateSnapshot } from "./noteVersions";

export const importBatch = mutation({
  args: {
    notes: v.array(
      v.object({
        title: v.string(),
        content: v.string(),
        vaultId: v.id("vaults"),
        folderId: v.optional(v.id("folders")),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    if (args.notes.length > 0) {
      await verifyVaultAccess(
        ctx.db,
        args.notes[0]!.vaultId,
        userId,
        "editor"
      );
    }
    const now = Date.now();
    for (const note of args.notes) {
      const noteId = await ctx.db.insert("notes", {
        title: note.title,
        content: note.content,
        vaultId: note.vaultId,
        folderId: note.folderId,
        order: note.order,
        createdAt: now,
        updatedAt: now,
      });
      await logAudit(ctx.db, {
        vaultId: note.vaultId,
        userId,
        action: "create",
        targetType: "note",
        targetId: noteId,
        targetName: note.title,
      });
    }
  },
});

export const list = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    await verifyVaultAccess(ctx.db, args.vaultId, userId, "viewer");
    const all = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    return all.filter((n) => n.isDeleted !== true);
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
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "viewer");
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
    await verifyVaultAccess(ctx.db, args.vaultId, userId, "editor");
    const siblings = await ctx.db
      .query("notes")
      .withIndex("by_folder", (q) =>
        q.eq("vaultId", args.vaultId).eq("folderId", args.folderId)
      )
      .collect();
    const now = Date.now();
    const noteId = await ctx.db.insert("notes", {
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
      userId,
      action: "create",
      targetType: "note",
      targetId: noteId,
      targetName: args.title,
    });
    return noteId;
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
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "editor");

    await maybeCreateSnapshot(ctx.db, {
      noteId: args.id,
      vaultId: note.vaultId,
      userId,
      trigger: "auto",
    });

    await ctx.db.patch(args.id, {
      content: args.content,
      updatedAt: Date.now(),
      updatedBy: userId,
    });

    await logAudit(ctx.db, {
      vaultId: note.vaultId,
      userId,
      action: "update",
      targetType: "note",
      targetId: args.id,
      targetName: note.title,
    });
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
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "editor");

    const oldTitle = note.title;
    const newTitle = args.title;

    // Snapshot before rename
    await maybeCreateSnapshot(ctx.db, {
      noteId: args.id,
      vaultId: note.vaultId,
      userId,
      trigger: "rename",
    });

    // Update the note title
    await ctx.db.patch(args.id, { title: newTitle, updatedAt: Date.now(), updatedBy: userId });

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
      vaultId: note.vaultId,
      userId,
      action: "rename",
      targetType: "note",
      targetId: args.id,
      targetName: newTitle,
      metadata: { oldTitle, newTitle },
    });
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
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "editor");

    const fromFolder = note.folderId ?? null;

    await maybeCreateSnapshot(ctx.db, {
      noteId: args.id,
      vaultId: note.vaultId,
      userId,
      trigger: "move",
    });

    await ctx.db.patch(args.id, { folderId: args.folderId });

    await logAudit(ctx.db, {
      vaultId: note.vaultId,
      userId,
      action: "move",
      targetType: "note",
      targetId: args.id,
      targetName: note.title,
      metadata: { fromFolder, toFolder: args.folderId ?? null },
    });
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
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "editor");

    // Snapshot before soft delete
    await maybeCreateSnapshot(ctx.db, {
      noteId: args.id,
      vaultId: note.vaultId,
      userId,
      trigger: "delete",
    });

    // Soft delete instead of hard delete
    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: userId,
    });

    await logAudit(ctx.db, {
      vaultId: note.vaultId,
      userId,
      action: "delete",
      targetType: "note",
      targetId: args.id,
      targetName: note.title,
    });
  },
});

export const search = query({
  args: { vaultId: v.id("vaults"), query: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    await verifyVaultAccess(ctx.db, args.vaultId, userId, "viewer");

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

    // Merge, deduplicate, and filter out deleted
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

export const getBacklinks = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "viewer");

    const allNotes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", note.vaultId))
      .collect();

    const backlinks: { noteId: typeof note._id; noteTitle: string; context: string }[] = [];
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

export const getUnlinkedMentions = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "viewer");

    if (!note.title) return [];

    const allNotes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", note.vaultId))
      .collect();

    const mentions: { noteId: typeof note._id; noteTitle: string; context: string }[] = [];
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
