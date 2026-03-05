/**
 * Wrap raw JSON blocks (not already inside code fences) in ```json fences
 * so they render as formatted code blocks in the markdown preview.
 */
function wrapRawJsonBlocks(content: string): string {
  // Split out existing code fences so we don't double-wrap
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part, i) => {
      // Odd indices are existing code fences — leave alone
      if (i % 2 === 1) return part;

      // In non-code regions, find multi-line JSON blocks:
      // starts with optional whitespace then { or [, ends with } or ]
      return part.replace(
        /(?:^|\n)([ \t]*[\[{]\n[\s\S]*?\n[ \t]*[\]}])(?=\n|$)/g,
        (match, jsonBlock: string) => {
          // Verify it looks like valid JSON (starts/ends with matching brackets)
          const trimmed = jsonBlock.trim();
          const open = trimmed[0];
          const close = trimmed[trimmed.length - 1];
          if ((open === "{" && close === "}") || (open === "[" && close === "]")) {
            return match.replace(jsonBlock, "```json\n" + jsonBlock + "\n```");
          }
          return match;
        }
      );
    })
    .join("");
}

/**
 * Pre-process markdown content to convert wiki links and tags
 * into standard markdown links, while preserving code blocks.
 */
export function preprocessContent(content: string): string {
  // First, wrap any raw JSON blocks in code fences
  const withJsonFenced = wrapRawJsonBlocks(content);

  // Split on fenced code blocks and inline code to avoid transforming them
  const parts = withJsonFenced.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

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
