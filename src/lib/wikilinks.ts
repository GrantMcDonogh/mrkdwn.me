/**
 * Shared wiki-link utilities.
 *
 * Pure functions extracted from editor/wikiLinks.ts and convex/notes.ts
 * so they can be tested independently and reused across the codebase.
 */

export interface WikiLinkParts {
  title: string;
  alias: string | null;
  heading: string | null;
}

/** Parse the inner text of a wiki link (between `[[` and `]]`). */
export function parseWikiLinkInner(inner: string): WikiLinkParts {
  let title = inner;
  let alias: string | null = null;
  let heading: string | null = null;

  const pipeIdx = inner.indexOf("|");
  const hashIdx = inner.indexOf("#");

  if (pipeIdx !== -1) {
    title = inner.substring(0, pipeIdx);
    alias = inner.substring(pipeIdx + 1);
  } else if (hashIdx !== -1) {
    title = inner.substring(0, hashIdx);
    heading = inner.substring(hashIdx + 1);
  }

  return { title, alias, heading };
}

/** Check whether `content` contains a wiki-link backlink to `noteTitle`. */
export function contentHasBacklinkTo(
  content: string,
  noteTitle: string,
): boolean {
  return (
    content.includes(`[[${noteTitle}]]`) ||
    content.includes(`[[${noteTitle}|`) ||
    content.includes(`[[${noteTitle}#`)
  );
}

/**
 * Replace all wiki-link references from `oldTitle` to `newTitle` in `content`.
 * Returns the updated content (unchanged if no matches).
 */
export function applyWikiLinkRename(
  content: string,
  oldTitle: string,
  newTitle: string,
): string {
  const patterns = [
    { find: `[[${oldTitle}]]`, replace: `[[${newTitle}]]` },
    { find: `[[${oldTitle}|`, replace: `[[${newTitle}|` },
    { find: `[[${oldTitle}#`, replace: `[[${newTitle}#` },
  ];
  let result = content;
  for (const { find, replace } of patterns) {
    if (result.includes(find)) {
      result = result.split(find).join(replace);
    }
  }
  return result;
}

/**
 * Check if `line` contains an *unlinked* (plain-text) mention of `title`.
 * Returns `true` when the title appears case-insensitively and is NOT
 * already inside a `[[ ]]` span.
 */
export function isUnlinkedMention(line: string, title: string): boolean {
  const lineLower = line.toLowerCase();
  const titleLower = title.toLowerCase();
  if (!lineLower.includes(titleLower)) return false;

  const idx = lineLower.indexOf(titleLower);
  const before = line.substring(0, idx);
  // If the most recent [[ is not closed by ]], the mention is inside a link.
  if (before.lastIndexOf("[[") > before.lastIndexOf("]]")) return false;

  return true;
}
