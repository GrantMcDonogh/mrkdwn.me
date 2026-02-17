import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const buildContext = internalQuery({
  args: { vaultId: v.string(), query: v.string() },
  handler: async (ctx, args) => {
    const vaultId = args.vaultId as any;

    // Search for relevant notes using the query
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

    // Merge and deduplicate
    const seen = new Set<string>();
    const ranked = [];
    for (const note of [...titleResults, ...contentResults]) {
      if (!seen.has(note._id)) {
        seen.add(note._id);
        ranked.push(note);
      }
    }

    // Build two-tier context
    let context = "";
    let charCount = 0;
    const maxChars = 80_000;

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

    // If no search results, include some notes anyway
    if (ranked.length === 0) {
      const allNotes = await ctx.db
        .query("notes")
        .withIndex("by_vault", (q) => q.eq("vaultId", vaultId))
        .take(15);
      for (const note of allNotes.slice(0, 5)) {
        const block = `## ${note.title}\n\n${note.content}\n\n---\n\n`;
        if (charCount + block.length > maxChars) break;
        context += block;
        charCount += block.length;
      }
      for (const note of allNotes.slice(5)) {
        const block = `## ${note.title} (title only)\n\n---\n\n`;
        if (charCount + block.length > maxChars) break;
        context += block;
        charCount += block.length;
      }
    }

    return { context };
  },
});
