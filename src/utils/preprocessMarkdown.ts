/**
 * Pre-process markdown content to convert wiki links and tags
 * into standard markdown links, while preserving code blocks.
 */
export function preprocessContent(content: string): string {
  // Split on fenced code blocks and inline code to avoid transforming them
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return parts
    .map((part, i) => {
      // Odd indices are code blocks/inline code — leave them alone
      if (i % 2 === 1) return part;

      // Convert wiki links: [[Title|Alias]] or [[Title]]
      let processed = part.replace(
        /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
        (_match, title: string, alias?: string) => {
          const display = alias ?? title;
          return `[${display}](wikilink://${encodeURIComponent(title)})`;
        }
      );

      // Convert tags: #tag (not inside headings at line start)
      processed = processed.replace(
        /(?<=\s|^)#([a-zA-Z][\w-/]*)/gm,
        (_match, tag: string) => `[#${tag}](tag://${tag})`
      );

      return processed;
    })
    .join("");
}
