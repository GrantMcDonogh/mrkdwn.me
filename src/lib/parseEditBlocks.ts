export interface EditBlock {
  type: "edit" | "create";
  noteTitle: string;
  content: string;
  status: "pending" | "applied" | "dismissed";
}

export function parseEditBlocks(text: string): EditBlock[] {
  const blocks: EditBlock[] = [];
  const regex = /````(edit|create):(.+?)\n([\s\S]*?)````/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
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
