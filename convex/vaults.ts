import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyVaultAccess, getVaultRole } from "./auth";
import type { VaultRole } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;

    // Owned vaults
    const owned = await ctx.db
      .query("vaults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const ownedResults = owned.map((v) => ({
      ...v,
      role: "owner" as VaultRole,
    }));

    // Shared vaults (accepted memberships)
    const memberships = await ctx.db
      .query("vaultMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const sharedResults = [];
    for (const m of memberships) {
      if (m.status !== "accepted") continue;
      const vault = await ctx.db.get(m.vaultId);
      if (vault) {
        sharedResults.push({
          ...vault,
          role: m.role as VaultRole,
        });
      }
    }

    return [...ownedResults, ...sharedResults];
  },
});

export const get = query({
  args: { id: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const role = await getVaultRole(ctx.db, args.id, userId);
    if (!role) throw new Error("Vault not found");
    const vault = await ctx.db.get(args.id);
    if (!vault) throw new Error("Vault not found");
    return { ...vault, role };
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    return ctx.db.insert("vaults", {
      name: args.name,
      userId,
      createdAt: Date.now(),
    });
  },
});

export const importCreateVault = internalMutation({
  args: { name: v.string(), userId: v.string(), settings: v.optional(v.any()) },
  handler: async (ctx, args) => {
    return ctx.db.insert("vaults", {
      name: args.name,
      userId: args.userId,
      createdAt: Date.now(),
      settings: args.settings,
    });
  },
});

export const rename = mutation({
  args: { id: v.id("vaults"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await verifyVaultAccess(ctx.db, args.id, identity.tokenIdentifier, "owner");
    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const remove = mutation({
  args: { id: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await verifyVaultAccess(ctx.db, args.id, identity.tokenIdentifier, "owner");

    // Cascade: delete all note versions
    const noteVersions = await ctx.db
      .query("noteVersions")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.id))
      .collect();
    for (const version of noteVersions) {
      await ctx.db.delete(version._id);
    }
    // Cascade: delete all notes
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.id))
      .collect();
    for (const note of notes) {
      await ctx.db.delete(note._id);
    }
    // Cascade: delete all folders
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.id))
      .collect();
    for (const folder of folders) {
      await ctx.db.delete(folder._id);
    }
    // Cascade: delete all audit log entries
    const auditEntries = await ctx.db
      .query("auditLog")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.id))
      .collect();
    for (const entry of auditEntries) {
      await ctx.db.delete(entry._id);
    }
    // Cascade: delete all vault memberships
    const members = await ctx.db
      .query("vaultMembers")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.id))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }
    // Cascade: delete all API keys
    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.id))
      .collect();
    for (const key of apiKeys) {
      await ctx.db.delete(key._id);
    }
    await ctx.db.delete(args.id);
  },
});
