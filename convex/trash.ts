import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { verifyVaultAccess } from "./auth";
import { logAudit } from "./auditLog";

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

export const listDeleted = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await verifyVaultAccess(ctx.db, args.vaultId, identity.tokenIdentifier, "viewer");

    const deletedNotes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    const filteredNotes = deletedNotes
      .filter((n) => n.isDeleted === true)
      .map((n) => ({
        _id: n._id,
        type: "note" as const,
        name: n.title,
        folderId: n.folderId,
        deletedAt: n.deletedAt!,
        deletedBy: n.deletedBy,
      }));

    const deletedFolders = await ctx.db
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    const filteredFolders = deletedFolders
      .filter((f) => f.isDeleted === true)
      .map((f) => ({
        _id: f._id,
        type: "folder" as const,
        name: f.name,
        folderId: f.parentId,
        deletedAt: f.deletedAt!,
        deletedBy: f.deletedBy,
      }));

    return [...filteredNotes, ...filteredFolders].sort(
      (a, b) => b.deletedAt - a.deletedAt
    );
  },
});

export const getDeletedCount = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await verifyVaultAccess(ctx.db, args.vaultId, identity.tokenIdentifier, "viewer");

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();

    return (
      notes.filter((n) => n.isDeleted === true).length +
      folders.filter((f) => f.isDeleted === true).length
    );
  },
});

export const restoreNote = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "editor");

    // If the parent folder is also deleted, restore to vault root
    let folderId = note.folderId;
    if (folderId) {
      const parent = await ctx.db.get(folderId);
      if (!parent || parent.isDeleted === true) {
        folderId = undefined;
      }
    }

    await ctx.db.patch(args.id, {
      isDeleted: undefined,
      deletedAt: undefined,
      deletedBy: undefined,
      folderId,
    });

    await logAudit(ctx.db, {
      vaultId: note.vaultId,
      userId,
      action: "restore",
      targetType: "note",
      targetId: args.id,
      targetName: note.title,
    });
  },
});

export const restoreFolder = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const folder = await ctx.db.get(args.id);
    if (!folder) throw new Error("Folder not found");
    await verifyVaultAccess(ctx.db, folder.vaultId, userId, "editor");

    const deletedAt = folder.deletedAt;

    // If the parent folder is also deleted, restore to vault root
    let parentId = folder.parentId;
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent || parent.isDeleted === true) {
        parentId = undefined;
      }
    }

    // Restore this folder
    await ctx.db.patch(args.id, {
      isDeleted: undefined,
      deletedAt: undefined,
      deletedBy: undefined,
      parentId,
    });

    // Restore descendant folders that were deleted at the same time
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", folder.vaultId))
      .collect();

    async function restoreDescendantFolders(parentFolderId: Id<"folders">) {
      const children = allFolders.filter(
        (f) => f.parentId === parentFolderId && f.isDeleted === true && f.deletedAt === deletedAt
      );
      for (const child of children) {
        await ctx.db.patch(child._id, {
          isDeleted: undefined,
          deletedAt: undefined,
          deletedBy: undefined,
        });
        await restoreDescendantFolders(child._id);
      }
    }
    await restoreDescendantFolders(args.id);

    // Restore notes in all restored folders that were deleted at the same time
    const restoredFolderIds = new Set<string>([args.id]);
    for (const f of allFolders) {
      if (f.deletedAt === deletedAt && f.isDeleted !== true) {
        // Already restored above — but we need to collect them
      }
    }
    // Re-query to get current state after patches
    const updatedFolders = await ctx.db
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", folder.vaultId))
      .collect();

    // Collect all folder IDs that were part of this restore (the ones that are now not deleted)
    function collectRestoredFolderIds(parentFolderId: Id<"folders">) {
      restoredFolderIds.add(parentFolderId);
      const children = updatedFolders.filter(
        (f) => f.parentId === parentFolderId && f.isDeleted !== true
      );
      for (const child of children) {
        collectRestoredFolderIds(child._id);
      }
    }
    collectRestoredFolderIds(args.id);

    // Restore notes in restored folders
    const allNotes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", folder.vaultId))
      .collect();
    for (const note of allNotes) {
      if (
        note.isDeleted === true &&
        note.deletedAt === deletedAt &&
        note.folderId &&
        restoredFolderIds.has(note.folderId)
      ) {
        await ctx.db.patch(note._id, {
          isDeleted: undefined,
          deletedAt: undefined,
          deletedBy: undefined,
        });
      }
    }

    await logAudit(ctx.db, {
      vaultId: folder.vaultId,
      userId,
      action: "restore",
      targetType: "folder",
      targetId: args.id,
      targetName: folder.name,
    });
  },
});

export const permanentDeleteNote = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "owner");

    // Delete all versions
    const versions = await ctx.db
      .query("noteVersions")
      .withIndex("by_note", (q) => q.eq("noteId", args.id))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    await logAudit(ctx.db, {
      vaultId: note.vaultId,
      userId,
      action: "permanent_delete",
      targetType: "note",
      targetId: args.id,
      targetName: note.title,
    });

    await ctx.db.delete(args.id);
  },
});

export const permanentDeleteFolder = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const folder = await ctx.db.get(args.id);
    if (!folder) throw new Error("Folder not found");
    await verifyVaultAccess(ctx.db, folder.vaultId, userId, "owner");

    // Promote any remaining children to parent
    const childFolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) =>
        q.eq("vaultId", folder.vaultId).eq("parentId", args.id)
      )
      .collect();
    for (const child of childFolders) {
      await ctx.db.patch(child._id, { parentId: folder.parentId });
    }

    const childNotes = await ctx.db
      .query("notes")
      .withIndex("by_folder", (q) =>
        q.eq("vaultId", folder.vaultId).eq("folderId", args.id)
      )
      .collect();
    for (const note of childNotes) {
      await ctx.db.patch(note._id, { folderId: folder.parentId });
    }

    await logAudit(ctx.db, {
      vaultId: folder.vaultId,
      userId,
      action: "permanent_delete",
      targetType: "folder",
      targetId: args.id,
      targetName: folder.name,
    });

    await ctx.db.delete(args.id);
  },
});

export const emptyTrash = mutation({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    await verifyVaultAccess(ctx.db, args.vaultId, userId, "owner");

    // Delete all soft-deleted notes and their versions
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    for (const note of notes) {
      if (note.isDeleted !== true) continue;
      const versions = await ctx.db
        .query("noteVersions")
        .withIndex("by_note", (q) => q.eq("noteId", note._id))
        .collect();
      for (const version of versions) {
        await ctx.db.delete(version._id);
      }
      await ctx.db.delete(note._id);
    }

    // Delete all soft-deleted folders
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    for (const folder of folders) {
      if (folder.isDeleted !== true) continue;
      await ctx.db.delete(folder._id);
    }
  },
});

export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - FIVE_YEARS_MS;

    // Purge expired notes
    // We need to scan all vaults — use a batch approach
    const expiredNotes = await ctx.db
      .query("notes")
      .filter((q) =>
        q.and(
          q.eq(q.field("isDeleted"), true),
          q.lt(q.field("deletedAt"), cutoff)
        )
      )
      .take(100);

    for (const note of expiredNotes) {
      const versions = await ctx.db
        .query("noteVersions")
        .withIndex("by_note", (q) => q.eq("noteId", note._id))
        .collect();
      for (const version of versions) {
        await ctx.db.delete(version._id);
      }
      await ctx.db.delete(note._id);
    }

    // Purge expired folders
    const expiredFolders = await ctx.db
      .query("folders")
      .filter((q) =>
        q.and(
          q.eq(q.field("isDeleted"), true),
          q.lt(q.field("deletedAt"), cutoff)
        )
      )
      .take(100);

    for (const folder of expiredFolders) {
      await ctx.db.delete(folder._id);
    }
  },
});
