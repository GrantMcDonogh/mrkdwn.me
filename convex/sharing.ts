import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyVaultAccess } from "./auth";

export const inviteCollaborator = mutation({
  args: {
    vaultId: v.id("vaults"),
    email: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;
    await verifyVaultAccess(ctx.db, args.vaultId, userId, "owner");

    const normalizedEmail = args.email.toLowerCase().trim();
    if (!normalizedEmail) throw new Error("Email is required");

    // Check for existing membership by email for this vault
    const existing = await ctx.db
      .query("vaultMembers")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .filter((q) => q.eq(q.field("email"), normalizedEmail))
      .first();

    if (existing) {
      throw new Error("User is already invited to this vault");
    }

    return ctx.db.insert("vaultMembers", {
      vaultId: args.vaultId,
      userId: "",
      email: normalizedEmail,
      role: args.role,
      invitedBy: userId,
      invitedAt: Date.now(),
      status: "pending",
    });
  },
});

export const acceptInvitation = mutation({
  args: {
    membershipId: v.id("vaultMembers"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.status !== "pending") {
      throw new Error("Invitation not found");
    }

    // Verify the caller's email matches the invite
    const userEmail = args.email.toLowerCase().trim();
    if (!userEmail || userEmail !== membership.email) {
      throw new Error("This invitation is not for your account");
    }

    await ctx.db.patch(args.membershipId, {
      userId: identity.tokenIdentifier,
      status: "accepted",
      acceptedAt: Date.now(),
    });
  },
});

export const getPendingInvitations = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const email = args.email.toLowerCase().trim();
    if (!email) return [];

    const pending = await ctx.db
      .query("vaultMembers")
      .withIndex("by_email_status", (q) =>
        q.eq("email", email).eq("status", "pending")
      )
      .collect();

    // Enrich with vault names
    const results = [];
    for (const m of pending) {
      const vault = await ctx.db.get(m.vaultId);
      if (vault) {
        results.push({
          ...m,
          vaultName: vault.name,
        });
      }
    }
    return results;
  },
});

export const listCollaborators = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await verifyVaultAccess(
      ctx.db,
      args.vaultId,
      identity.tokenIdentifier,
      "viewer"
    );

    const vault = await ctx.db.get(args.vaultId);
    if (!vault) throw new Error("Vault not found");

    const members = await ctx.db
      .query("vaultMembers")
      .withIndex("by_vault", (q) => q.eq("vaultId", args.vaultId))
      .collect();

    return {
      owner: { userId: vault.userId },
      members: members.map((m) => ({
        _id: m._id,
        email: m.email,
        role: m.role,
        status: m.status,
      })),
    };
  },
});

export const updateCollaboratorRole = mutation({
  args: {
    membershipId: v.id("vaultMembers"),
    role: v.union(v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membership not found");

    await verifyVaultAccess(
      ctx.db,
      membership.vaultId,
      identity.tokenIdentifier,
      "owner"
    );

    await ctx.db.patch(args.membershipId, { role: args.role });
  },
});

export const removeCollaborator = mutation({
  args: { membershipId: v.id("vaultMembers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membership not found");

    const userId = identity.tokenIdentifier;
    const vault = await ctx.db.get(membership.vaultId);
    if (!vault) throw new Error("Vault not found");

    // Allow: owner removing anyone, or member removing themselves (leave)
    const isOwner = vault.userId === userId;
    const isSelf = membership.userId === userId;
    if (!isOwner && !isSelf) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.membershipId);
  },
});
