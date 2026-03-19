import { useEffect, useRef, useId, useState } from "react";
import mermaid from "mermaid";

let initialized = false;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
      darkMode: true,
      background: "#1e1e2e",
      primaryColor: "#7c3aed",
      primaryTextColor: "#dcddde",
      primaryBorderColor: "#4c4f69",
      lineColor: "#6c7086",
      secondaryColor: "#313244",
      tertiaryColor: "#45475a",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
  });
}

interface Props {
  chart: string;
}

export default function MermaidDiagram({ chart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "_");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    ensureInit();

    let cancelled = false;

    (async () => {
      try {
        // mermaid.render() returns sanitized SVG (uses DOMPurify internally)
        const { svg } = await mermaid.render(`mermaid${uniqueId}`, chart);
        if (!cancelled) {
          el.innerHTML = svg; // safe: mermaid sanitizes SVG output via DOMPurify
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          // mermaid leaves error elements in the DOM — clean up
          document.querySelector(`#dmermaid${uniqueId}`)?.remove();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, uniqueId]);

  if (error) {
    return (
      <div className="bg-obsidian-bg border border-red-900/50 rounded p-3 my-2">
        <p className="text-xs text-red-400 mb-2">Mermaid diagram error: {error}</p>
        <pre className="text-xs text-obsidian-text-muted font-mono overflow-x-auto">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-2 flex justify-center [&_svg]:max-w-full"
    />
  );
}
