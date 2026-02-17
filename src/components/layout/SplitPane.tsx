import { useState, useCallback, useRef, type ReactNode } from "react";

interface Props {
  direction: "horizontal" | "vertical";
  children: [ReactNode, ReactNode];
}

export default function SplitPane({ direction, children }: Props) {
  const [ratio, setRatio] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let newRatio: number;
        if (direction === "vertical") {
          newRatio = (moveEvent.clientX - rect.left) / rect.width;
        } else {
          newRatio = (moveEvent.clientY - rect.top) / rect.height;
        }
        // Constrain 20%-80%
        newRatio = Math.max(0.2, Math.min(0.8, newRatio));
        setRatio(newRatio);
      };

      const onMouseUp = () => {
        draggingRef.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [direction]
  );

  const isVertical = direction === "vertical";

  return (
    <div
      ref={containerRef}
      className={`flex h-full ${isVertical ? "flex-row" : "flex-col"}`}
    >
      <div
        style={{ flexBasis: `${ratio * 100}%` }}
        className="min-w-0 min-h-0 overflow-hidden flex"
      >
        {children[0]}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={`shrink-0 ${
          isVertical
            ? "w-1 cursor-col-resize"
            : "h-1 cursor-row-resize"
        } bg-obsidian-border hover:bg-obsidian-accent transition-colors`}
      />
      <div
        style={{ flexBasis: `${(1 - ratio) * 100}%` }}
        className="min-w-0 min-h-0 overflow-hidden flex"
      >
        {children[1]}
      </div>
    </div>
  );
}
