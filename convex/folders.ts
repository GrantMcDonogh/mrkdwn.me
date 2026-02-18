import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

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
    await verifyVaultOwnership(ctx, args.vaultId, userId);
    return ctx.db
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
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
    await verifyVaultOwnership(ctx, args.vaultId, userId);
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

export const rename = mutation({
  args: { id: v.id("folders"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const folder = await ctx.db.get(args.id);
    if (!folder) throw new Error("Folder not found");
    await verifyVaultOwnership(ctx, folder.vaultId, userId);
    await ctx.db.patch(args.id, { name: args.name });
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
    await verifyVaultOwnership(ctx, folder.vaultId, userId);
    await ctx.db.patch(args.id, { parentId: args.parentId });
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
    await verifyVaultOwnership(ctx, folder.vaultId, userId);

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
