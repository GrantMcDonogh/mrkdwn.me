import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";

// Decoration marks
const headingDeco = (level: number) =>
  Decoration.line({
    attributes: { class: `cm-heading-${Math.min(level, 4)}` },
  });

const boldMark = Decoration.mark({ class: "cm-bold", attributes: { style: "font-weight: bold" } });
const italicMark = Decoration.mark({ class: "cm-italic", attributes: { style: "font-style: italic" } });
const inlineCodeMark = Decoration.mark({ class: "cm-inline-code" });
const blockquoteLine = Decoration.line({ attributes: { class: "cm-blockquote-line" } });
const tagMark = Decoration.mark({ class: "cm-tag-mark" });

// HR widget
class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("hr");
    hr.style.border = "none";
    hr.style.borderTop = "1px solid #3e3e3e";
    hr.style.margin = "1em 0";
    return hr;
  }
}

// Checkbox widget
class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super();
  }

  toDOM(view: EditorView) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.style.cursor = "pointer";
    input.style.marginRight = "4px";
    input.addEventListener("click", (e) => {
      const pos = view.posAtDOM(input);
      const line = view.state.doc.lineAt(pos);
      const lineText = line.text;
      const checkIdx = lineText.indexOf(this.checked ? "[x]" : "[ ]");
      if (checkIdx !== -1) {
        const from = line.from + checkIdx;
        const to = from + 3;
        const replacement = this.checked ? "[ ]" : "[x]";
        view.dispatch({ changes: { from, to, insert: replacement } });
      }
      e.preventDefault();
    });
    return input;
  }

  ignoreEvent() {
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const ranges: { from: number; to: number; deco: Decoration }[] = [];

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        // Headings
        if (node.name.startsWith("ATXHeading")) {
          const level = parseInt(node.name.replace("ATXHeading", ""), 10) || 1;
          const line = doc.lineAt(node.from);
          ranges.push({ from: line.from, to: line.from, deco: headingDeco(level) });
        }

        // Bold (StrongEmphasis)
        if (node.name === "StrongEmphasis") {
          ranges.push({ from: node.from, to: node.to, deco: boldMark });
        }

        // Italic (Emphasis)
        if (node.name === "Emphasis") {
          ranges.push({ from: node.from, to: node.to, deco: italicMark });
        }

        // Inline code
        if (node.name === "InlineCode") {
          ranges.push({ from: node.from, to: node.to, deco: inlineCodeMark });
        }

        // Blockquote
        if (node.name === "Blockquote") {
          let pos = node.from;
          while (pos < node.to) {
            const line = doc.lineAt(pos);
            ranges.push({ from: line.from, to: line.from, deco: blockquoteLine });
            pos = line.to + 1;
          }
        }

        // Horizontal rule
        if (node.name === "HorizontalRule") {
          const line = doc.lineAt(node.from);
          ranges.push({
            from: line.from,
            to: line.to,
            deco: Decoration.replace({ widget: new HrWidget() }),
          });
        }

        // Task lists
        if (node.name === "TaskMarker") {
          const text = doc.sliceString(node.from, node.to);
          const checked = text.includes("x");
          ranges.push({
            from: node.from,
            to: node.to,
            deco: Decoration.replace({ widget: new CheckboxWidget(checked) }),
          });
        }
      },
    });
  }

  // Tags — scan visible lines for #tag patterns
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos < to) {
      const line = doc.lineAt(pos);
      const tagRegex = /(?:^|\s)(#[a-zA-Z][a-zA-Z0-9_-]*)/g;
      let match;
      while ((match = tagRegex.exec(line.text)) !== null) {
        const tagStart = line.from + match.index + (match[0].length - match[1]!.length);
        const tagEnd = tagStart + match[1]!.length;
        ranges.push({ from: tagStart, to: tagEnd, deco: tagMark });
      }
      pos = line.to + 1;
    }
  }

  // Sort by position to satisfy RangeSetBuilder ordering requirement
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  for (const r of ranges) {
    builder.add(r.from, r.to, r.deco);
  }
  return builder.finish();
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
