import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const hasOpenRouterKey = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { hasKey: false };
    const row = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .first();
    return { hasKey: !!row?.openRouterKey };
  },
});

export const saveOpenRouterKey = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { openRouterKey: args.key });
    } else {
      await ctx.db.insert("userSettings", {
        userId: identity.tokenIdentifier,
        openRouterKey: args.key,
      });
    }
  },
});

export const deleteOpenRouterKey = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { openRouterKey: undefined });
    }
  },
});

export const getOpenRouterKey = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return row?.openRouterKey ?? null;
  },
});
