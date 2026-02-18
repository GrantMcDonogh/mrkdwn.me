import type { ImportedFolder, ImportedNote } from "./importVault";

export interface GeneratedVaultData {
  vaultName: string;
  folders: ImportedFolder[];
  notes: ImportedNote[];
}

/**
 * Strips markdown code fencing from Claude's response text.
 */
export function stripMarkdownFencing(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
}

/**
 * Extracts the text content from a Claude API response body.
 */
export function extractClaudeText(
  responseBody: Record<string, unknown>
): string {
  const content = responseBody.content;
  if (!Array.isArray(content) || content.length === 0) return "";
  const block = content[0];
  if (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    block.type === "text" &&
    "text" in block &&
    typeof block.text === "string"
  ) {
    return block.text;
  }
  return "";
}

/**
 * Parses and validates a generated vault JSON string.
 * Returns the parsed data or throws an error with a descriptive message.
 */
export function parseGeneratedVault(text: string): GeneratedVaultData {
  const stripped = stripMarkdownFencing(text);
  const parsed = JSON.parse(stripped);

  if (
    !parsed.vaultName ||
    typeof parsed.vaultName !== "string"
  ) {
    throw new Error("Missing or invalid vaultName");
  }

  if (!Array.isArray(parsed.folders)) {
    throw new Error("Missing or invalid folders array");
  }

  if (!Array.isArray(parsed.notes)) {
    throw new Error("Missing or invalid notes array");
  }

  return parsed as GeneratedVaultData;
}

/**
 * Builds the user message for the Claude API from wizard answers.
 */
export function buildUserMessage(
  answers: Record<string, string | string[] | undefined>
): string {
  const topics = Array.isArray(answers.topics)
    ? answers.topics.join(", ")
    : (answers.topics ?? "Mixed");

  return `Create a vault for someone with these preferences:
- Primary use: ${answers.purpose ?? "General second brain"}
- Topics of interest: ${topics}
- Organization style: ${answers.organization ?? "By topic"}
- Starter content: ${answers.starter ?? "Templates & examples"}`;
}
