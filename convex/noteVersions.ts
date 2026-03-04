import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import type { Id } from "./_generated/dataModel";
import { verifyVaultAccess } from "./auth";

const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export async function maybeCreateSnapshot(
  db: GenericDatabaseWriter<DataModel>,
  args: {
    noteId: Id<"notes">;
    vaultId: Id<"vaults">;
    userId: string;
    trigger: "auto" | "rename" | "move" | "delete";
  }
) {
  const note = await db.get(args.noteId);
  if (!note) return;

  // For non-auto triggers, always create a snapshot
  if (args.trigger !== "auto") {
    await db.insert("noteVersions", {
      noteId: args.noteId,
      vaultId: args.vaultId,
      title: note.title,
      content: note.content,
      savedBy: args.userId,
      savedAt: Date.now(),
      trigger: args.trigger,
    });
    return;
  }

  // For auto trigger, check throttle
  const latest = await db
    .query("noteVersions")
    .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
    .order("desc")
    .first();

  if (latest && Date.now() - latest.savedAt < THROTTLE_MS) {
    return; // Too recent, skip
  }

  await db.insert("noteVersions", {
    noteId: args.noteId,
    vaultId: args.vaultId,
    title: note.title,
    content: note.content,
    savedBy: args.userId,
    savedAt: Date.now(),
    trigger: "auto",
  });
}

export const listByNote = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    await verifyVaultAccess(ctx.db, note.vaultId, identity.tokenIdentifier, "viewer");

    return ctx.db
      .query("noteVersions")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("noteVersions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const version = await ctx.db.get(args.id);
    if (!version) throw new Error("Version not found");
    await verifyVaultAccess(ctx.db, version.vaultId, identity.tokenIdentifier, "viewer");
    return version;
  },
});

export const restoreVersion = mutation({
  args: { noteId: v.id("notes"), versionId: v.id("noteVersions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.tokenIdentifier;

    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    await verifyVaultAccess(ctx.db, note.vaultId, userId, "editor");

    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    // Snapshot current state before restoring
    await maybeCreateSnapshot(ctx.db, {
      noteId: args.noteId,
      vaultId: note.vaultId,
      userId,
      trigger: "auto",
    });

    await ctx.db.patch(args.noteId, {
      title: version.title,
      content: version.content,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
  },
});
