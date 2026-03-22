export interface EditBlock {
  type: "edit" | "create";
  noteTitle: string;
  content: string;
  status: "pending" | "applied" | "dismissed";
}

/**
 * Auto-close any unclosed ````edit: or ````create: blocks.
 * Handles the case where the AI hits the max token limit
 * and the response is truncated before the closing ````.
 */
function closeUnclosedBlocks(text: string): string {
  const openPattern = /````(?:edit|create):.+?\n/g;
  const opens: number[] = [];
  let m;
  while ((m = openPattern.exec(text)) !== null) opens.push(m.index);

  for (const openIdx of opens) {
    const afterOpen = text.slice(openIdx).match(/````(?:edit|create):.+?\n/);
    const searchStart = openIdx + (afterOpen?.[0].length ?? 0);
    const rest = text.slice(searchStart);
    const hasClose = /````/.test(
      rest.replace(/````(?:edit|create):.+?\n/g, "")
    );
    if (!hasClose) {
      return text + "\n````";
    }
  }
  return text;
}

export function parseEditBlocks(text: string): EditBlock[] {
  const blocks: EditBlock[] = [];
  const closed = closeUnclosedBlocks(text);
  const regex = /````(edit|create):(.+?)\n([\s\S]*?)````/g;
  let match;
  while ((match = regex.exec(closed)) !== null) {
    blocks.push({
      type: match[1] as "edit" | "create",
      noteTitle: match[2]!.trim(),
      content: match[3]!,
      status: "pending",
    });
  }
  return blocks;
}

export function stripEditBlocks(text: string): string {
  return text.replace(/````(?:edit|create):.+?\n[\s\S]*?````/g, "").trim();
}
