import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    return ctx.db
      .query("vaults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const vault = await ctx.db.get(args.id);
    if (!vault || vault.userId !== userId) {
      throw new Error("Vault not found");
    }
    return vault;
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

export const rename = mutation({
  args: { id: v.id("vaults"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const vault = await ctx.db.get(args.id);
    if (!vault || vault.userId !== userId) {
      throw new Error("Vault not found");
    }
    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const remove = mutation({
  args: { id: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const vault = await ctx.db.get(args.id);
    if (!vault || vault.userId !== userId) {
      throw new Error("Vault not found");
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
    await ctx.db.delete(args.id);
  },
});
