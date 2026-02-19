import { diffLines } from "diff";

interface Props {
  original: string;
  proposed: string;
}

export default function DiffView({ original, proposed }: Props) {
  const changes = diffLines(original, proposed);

  return (
    <div className="text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto bg-obsidian-bg rounded border border-obsidian-border">
      {changes.map((change, i) => {
        const lines = change.value.replace(/\n$/, "").split("\n");
        return lines.map((line, j) => (
          <div
            key={`${i}-${j}`}
            className={`px-2 py-0.5 whitespace-pre ${
              change.added
                ? "bg-green-900/30 text-green-300"
                : change.removed
                  ? "bg-red-900/30 text-red-400 line-through"
                  : "text-obsidian-text-muted"
            }`}
          >
            <span className="inline-block w-4 text-obsidian-text-muted/50 select-none">
              {change.added ? "+" : change.removed ? "-" : " "}
            </span>
            {line || " "}
          </div>
        ));
      })}
    </div>
  );
}
