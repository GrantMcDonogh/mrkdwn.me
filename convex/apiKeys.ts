import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// --- Public (Clerk JWT auth, for frontend UI) ---

export const list = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    // Verify vault ownership
    const vault = await ctx.db.get(args.vaultId);
    if (!vault || vault.userId !== userId) throw new Error("Vault not found");
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();
    return keys.map((k) => ({
      _id: k._id,
      keyPrefix: k.keyPrefix,
      name: k.name,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }));
  },
});

export const create = action({
  args: { vaultId: v.id("vaults"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    // Verify vault ownership
    const vault = await ctx.runQuery(internal.apiKeys.getVaultForUser, {
      vaultId: args.vaultId,
      userId,
    });
    if (!vault) throw new Error("Vault not found");

    // Generate random key: mk_ + 64 hex chars (32 bytes)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const rawKey = `mk_${hex}`;
    const keyPrefix = rawKey.slice(0, 10);

    // Hash with SHA-256
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    await ctx.runMutation(internal.apiKeys.insertKey, {
      keyHash,
      keyPrefix,
      vaultId: args.vaultId,
      userId,
      name: args.name,
      createdAt: Date.now(),
    });

    return { key: rawKey };
  },
});

export const revoke = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    const key = await ctx.db.get(args.id);
    if (!key || key.userId !== userId) throw new Error("Key not found");
    await ctx.db.delete(args.id);
  },
});

// --- Internal (for httpAction API key validation) ---

export const validateKey = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    if (!key) return null;
    return { userId: key.userId, vaultId: key.vaultId, keyId: key._id };
  },
});

export const touchLastUsed = internalMutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastUsedAt: Date.now() });
  },
});

export const getVaultForUser = internalQuery({
  args: { vaultId: v.id("vaults"), userId: v.string() },
  handler: async (ctx, args) => {
    const vault = await ctx.db.get(args.vaultId);
    if (!vault || vault.userId !== args.userId) return null;
    return vault;
  },
});

export const insertKey = internalMutation({
  args: {
    keyHash: v.string(),
    keyPrefix: v.string(),
    vaultId: v.id("vaults"),
    userId: v.string(),
    name: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("apiKeys", args);
  },
});
