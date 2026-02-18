import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const createVaultWithFolders = action({
  args: {
    name: v.string(),
    settings: v.optional(v.any()),
    folders: v.array(
      v.object({
        tempId: v.string(),
        name: v.string(),
        parentTempId: v.optional(v.string()),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args): Promise<{ vaultId: Id<"vaults">; folderIdMap: Record<string, string> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const vaultId: Id<"vaults"> = await ctx.runMutation(internal.vaults.importCreateVault, {
      name: args.name,
      userId: identity.tokenIdentifier,
      settings: args.settings,
    });

    let folderIdMap: Record<string, string> = {};
    for (let i = 0; i < args.folders.length; i += 50) {
      const batch = args.folders.slice(i, i + 50).map((f) => ({
        ...f,
        vaultId,
      }));
      const newMappings = await ctx.runMutation(internal.folders.importBatch, {
        folders: batch,
        parentIdMap: folderIdMap,
      });
      folderIdMap = { ...folderIdMap, ...(newMappings as Record<string, string>) };
    }

    return { vaultId, folderIdMap };
  },
});
