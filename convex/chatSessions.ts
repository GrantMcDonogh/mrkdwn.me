import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, { vaultId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_vault_user", (q) =>
        q.eq("vaultId", vaultId).eq("userId", identity.tokenIdentifier)
      )
      .order("desc")
      .collect();

    return sessions;
  },
});

export const create = mutation({
  args: { vaultId: v.id("vaults"), title: v.optional(v.string()) },
  handler: async (ctx, { vaultId, title }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const now = Date.now();
    const sessionId = await ctx.db.insert("chatSessions", {
      vaultId,
      userId: identity.tokenIdentifier,
      title: title ?? "New chat",
      createdAt: now,
      updatedAt: now,
    });

    return sessionId;
  },
});

export const remove = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== identity.tokenIdentifier) {
      throw new Error("Session not found");
    }

    // Delete all messages in the session
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    await ctx.db.delete(sessionId);
  },
});

export const updateTitle = mutation({
  args: { sessionId: v.id("chatSessions"), title: v.string() },
  handler: async (ctx, { sessionId, title }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== identity.tokenIdentifier) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(sessionId, { title });
  },
});

export const getMessages = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== identity.tokenIdentifier) {
      throw new Error("Session not found");
    }

    return await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();
  },
});

export const saveMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, { sessionId, role, content }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== identity.tokenIdentifier) {
      throw new Error("Session not found");
    }

    const now = Date.now();

    const messageId = await ctx.db.insert("chatMessages", {
      sessionId,
      role,
      content,
      createdAt: now,
    });

    // Update session timestamp and auto-title from first user message
    const patch: { updatedAt: number; title?: string } = { updatedAt: now };
    if (role === "user" && session.title === "New chat") {
      // Use first ~50 chars of the first user message as title
      patch.title = content.length > 50 ? content.slice(0, 47) + "..." : content;
    }
    await ctx.db.patch(sessionId, patch);

    return messageId;
  },
});
