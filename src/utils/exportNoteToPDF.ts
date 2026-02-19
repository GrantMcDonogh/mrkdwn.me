import html2pdf from "html2pdf.js";
import { marked } from "marked";

/**
 * Strip wiki links and tags to plain text for PDF output.
 * Reuses the same regex patterns from MarkdownPreview's preprocessContent,
 * but outputs plain text instead of internal link markup.
 */
export function preprocessForPDF(content: string): string {
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;

      // [[Title|Alias]] → Alias, [[Title]] → Title
      let processed = part.replace(
        /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
        (_match, title: string, alias?: string) => alias ?? title
      );

      // #tag → tag (not headings)
      processed = processed.replace(
        /(?<=\s|^)#([a-zA-Z][\w-/]*)/gm,
        (_match, tag: string) => tag
      );

      return processed;
    })
    .join("");
}

export async function exportNoteToPDF(
  title: string,
  content: string
): Promise<void> {
  const cleaned = preprocessForPDF(content);
  const htmlBody = await marked.parse(cleaned);

  const container = document.createElement("div");
  container.innerHTML = `
    <div style="
      font-family: Georgia, 'Times New Roman', serif;
      color: #1a1a1a;
      line-height: 1.7;
      max-width: 100%;
      padding: 0;
    ">
      <h1 style="
        font-size: 24px;
        margin: 0 0 16px 0;
        padding-bottom: 8px;
        border-bottom: 1px solid #ddd;
      ">${title}</h1>
      ${htmlBody}
    </div>
  `;

  // Style tables, code blocks, and blockquotes for PDF
  container.querySelectorAll("table").forEach((table) => {
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.marginBottom = "16px";
  });
  container.querySelectorAll("th, td").forEach((cell) => {
    (cell as HTMLElement).style.border = "1px solid #ddd";
    (cell as HTMLElement).style.padding = "6px 12px";
    (cell as HTMLElement).style.textAlign = "left";
  });
  container.querySelectorAll("th").forEach((th) => {
    (th as HTMLElement).style.backgroundColor = "#f5f5f5";
    (th as HTMLElement).style.fontWeight = "bold";
  });
  container.querySelectorAll("pre").forEach((pre) => {
    pre.style.background = "#f5f5f5";
    pre.style.padding = "12px";
    pre.style.borderRadius = "4px";
    pre.style.overflowX = "auto";
    pre.style.fontSize = "13px";
    pre.style.lineHeight = "1.5";
  });
  container.querySelectorAll("code").forEach((code) => {
    if (code.parentElement?.tagName !== "PRE") {
      code.style.background = "#f0f0f0";
      code.style.padding = "1px 4px";
      code.style.borderRadius = "3px";
      code.style.fontSize = "0.9em";
    }
  });
  container.querySelectorAll("blockquote").forEach((bq) => {
    (bq as HTMLElement).style.borderLeft = "3px solid #ddd";
    (bq as HTMLElement).style.paddingLeft = "12px";
    (bq as HTMLElement).style.color = "#555";
    (bq as HTMLElement).style.margin = "12px 0";
  });

  const sanitizedTitle = title.replace(/[/\\:*?"<>|]/g, "_").trim() || "note";

  await html2pdf()
    .set({
      margin: [15, 15, 15, 15],
      filename: `${sanitizedTitle}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(container)
    .save();
}
