import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const buildEditContext = internalQuery({
  args: {
    vaultId: v.string(),
    query: v.string(),
    activeNoteId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const vaultId = args.vaultId as any;
    const maxChars = 80_000;
    let context = "";
    let charCount = 0;

    // If there's an active note, include its full content first
    let activeNoteTitle: string | null = null;
    if (args.activeNoteId) {
      try {
        const activeNote = await ctx.db.get(args.activeNoteId as any);
        if (activeNote) {
          activeNoteTitle = activeNote.title;
          const block =
            `## ACTIVE NOTE: ${activeNote.title}\n` +
            `(This is the note currently open in the editor)\n\n` +
            `${activeNote.content}\n\n---\n\n`;
          context += block;
          charCount += block.length;
        }
      } catch {
        // Invalid ID, skip
      }
    }

    // Search for relevant notes (same approach as chatHelpers)
    const titleResults = await ctx.db
      .query("notes")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("vaultId", vaultId)
      )
      .take(15);

    const contentResults = await ctx.db
      .query("notes")
      .withSearchIndex("search_content", (q) =>
        q.search("content", args.query).eq("vaultId", vaultId)
      )
      .take(15);

    // Merge and deduplicate, excluding active note
    const seen = new Set<string>();
    if (args.activeNoteId) seen.add(args.activeNoteId);
    const ranked = [];
    for (const note of [...titleResults, ...contentResults]) {
      if (!seen.has(note._id)) {
        seen.add(note._id);
        ranked.push(note);
      }
    }

    // Tier 1: Top 5 with full content
    for (let i = 0; i < Math.min(5, ranked.length); i++) {
      const note = ranked[i]!;
      const block = `## ${note.title}\n\n${note.content}\n\n---\n\n`;
      if (charCount + block.length > maxChars) break;
      context += block;
      charCount += block.length;
    }

    // Tier 2: Next 10 with title only
    for (let i = 5; i < Math.min(15, ranked.length); i++) {
      const note = ranked[i]!;
      const block = `## ${note.title} (title only)\n\n---\n\n`;
      if (charCount + block.length > maxChars) break;
      context += block;
      charCount += block.length;
    }

    // If no search results (besides active note), include some notes
    if (ranked.length === 0) {
      const allNotes = await ctx.db
        .query("notes")
        .withIndex("by_vault", (q) => q.eq("vaultId", vaultId))
        .take(15);
      const filtered = allNotes.filter(
        (n) => n._id !== args.activeNoteId
      );
      for (const note of filtered.slice(0, 5)) {
        const block = `## ${note.title}\n\n${note.content}\n\n---\n\n`;
        if (charCount + block.length > maxChars) break;
        context += block;
        charCount += block.length;
      }
      for (const note of filtered.slice(5)) {
        const block = `## ${note.title} (title only)\n\n---\n\n`;
        if (charCount + block.length > maxChars) break;
        context += block;
        charCount += block.length;
      }
    }

    return { context, activeNoteTitle };
  },
});
