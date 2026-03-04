import { query } from "./_generated/server";
import { v } from "convex/values";
import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import type { Id } from "./_generated/dataModel";
import { verifyVaultAccess } from "./auth";

export async function logAudit(
  db: GenericDatabaseWriter<DataModel>,
  args: {
    vaultId: Id<"vaults">;
    userId: string;
    action: "create" | "update" | "rename" | "move" | "delete" | "restore" | "permanent_delete";
    targetType: "note" | "folder";
    targetId: string;
    targetName: string;
    metadata?: Record<string, unknown>;
  }
) {
  await db.insert("auditLog", {
    vaultId: args.vaultId,
    userId: args.userId,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    targetName: args.targetName,
    metadata: args.metadata,
    timestamp: Date.now(),
  });
}

export const listByVault = query({
  args: {
    vaultId: v.id("vaults"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await verifyVaultAccess(ctx.db, args.vaultId, identity.tokenIdentifier, "viewer");

    const results = await ctx.db
      .query("auditLog")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .order("desc")
      .take(args.limit ?? 100);
    return results;
  },
});

export const listByTarget = query({
  args: { targetId: v.string(), vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await verifyVaultAccess(ctx.db, args.vaultId, identity.tokenIdentifier, "viewer");

    return ctx.db
      .query("auditLog")
      .withIndex("by_target", (q) => q.eq("targetId", args.targetId))
      .order("desc")
      .collect();
  },
});
