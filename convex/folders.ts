import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { verifyVaultAccess } from "./auth";
import { logAudit } from "./auditLog";

export const importBatch = internalMutation({
  args: {
    folders: v.array(
      v.object({
        tempId: v.string(),
        name: v.string(),
        vaultId: v.id("vaults"),
        parentTempId: v.optional(v.string()),
        order: v.number(),
      })
    ),
    parentIdMap: v.any(),
  },
  handler: async (ctx, args) => {
    const newMappings: Record<string, string> = {};
    for (const folder of args.folders) {
      const parentId = folder.parentTempId
        ? ((args.parentIdMap[folder.parentTempId] ??
            newMappings[folder.parentTempId]) as Id<"folders"> | undefined)
        : undefined;
      const id = await ctx.db.insert("folders", {
        name: folder.name,
        vaultId: folder.vaultId,
        parentId,
        order: folder.order,
      });
      newMappings[folder.tempId] = id;
    }
    return newMappings;
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
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    return all.filter((f) => f.isDeleted !== true);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    vaultId: v.id("vaults"),
    parentId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    await verifyVaultAccess(ctx.db, args.vaultId, userId, "editor");
    const siblings = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) =>
        q.eq("vaultId", args.vaultId).eq("parentId", args.parentId)
      )
      .collect();
    const folderId = await ctx.db.insert("folders", {
      name: args.name,
      vaultId: args.vaultId,
      parentId: args.parentId,
      order: siblings.filter((f) => f.isDeleted !== true).length,
    });
    await logAudit(ctx.db, {
      vaultId: args.vaultId,
      userId,
      action: "create",
      targetType: "folder",
      targetId: folderId,
      targetName: args.name,
    });
    return folderId;
  },
});

export const rename = mutation({
  args: { id: v.id("folders"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const folder = await ctx.db.get(args.id);
    if (!folder) throw new Error("Folder not found");
    await verifyVaultAccess(ctx.db, folder.vaultId, userId, "editor");

    const oldName = folder.name;
    await ctx.db.patch(args.id, { name: args.name });

    await logAudit(ctx.db, {
      vaultId: folder.vaultId,
      userId,
      action: "rename",
      targetType: "folder",
      targetId: args.id,
      targetName: args.name,
      metadata: { oldName, newName: args.name },
    });
  },
});

export const move = mutation({
  args: { id: v.id("folders"), parentId: v.optional(v.id("folders")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const folder = await ctx.db.get(args.id);
    if (!folder) throw new Error("Folder not found");
    await verifyVaultAccess(ctx.db, folder.vaultId, userId, "editor");

    const fromParent = folder.parentId ?? null;
    await ctx.db.patch(args.id, { parentId: args.parentId });

    await logAudit(ctx.db, {
      vaultId: folder.vaultId,
      userId,
      action: "move",
      targetType: "folder",
      targetId: args.id,
      targetName: folder.name,
      metadata: { fromParent, toParent: args.parentId ?? null },
    });
  },
});

export const remove = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const folder = await ctx.db.get(args.id);
    if (!folder) throw new Error("Folder not found");
    await verifyVaultAccess(ctx.db, folder.vaultId, userId, "editor");

    const now = Date.now();

    // Collect all descendant folder IDs recursively
    async function getDescendantFolderIds(parentId: Id<"folders">): Promise<Id<"folders">[]> {
      const children = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q) =>
          q.eq("vaultId", folder!.vaultId).eq("parentId", parentId)
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
        deletedBy: userId,
      });
    }

    // Soft delete all notes in these folders
    for (const folderId of allFolderIds) {
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_folder", (q) =>
          q.eq("vaultId", folder.vaultId).eq("folderId", folderId)
        )
        .collect();
      for (const note of notes) {
        if (note.isDeleted === true) continue;
        await ctx.db.patch(note._id, {
          isDeleted: true,
          deletedAt: now,
          deletedBy: userId,
        });
      }
    }

    await logAudit(ctx.db, {
      vaultId: folder.vaultId,
      userId,
      action: "delete",
      targetType: "folder",
      targetId: args.id,
      targetName: folder.name,
    });
  },
});
