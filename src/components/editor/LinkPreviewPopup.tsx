import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";
import { preprocessForPDF } from "../../utils/exportNoteToPDF";

interface Props {
  title: string;
  content: string | null;
  anchorRect: DOMRect;
  containerRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function LinkPreviewPopup({
  content,
  anchorRect,
  containerRect,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const processedContent = useMemo(() => {
    if (!content || content.trim() === "") return null;
    const truncated =
      content.length > 1500 ? content.slice(0, 1500) + "..." : content;
    return preprocessForPDF(truncated);
  }, [content]);

  // Position above the hovered link, relative to the container
  const left = anchorRect.left - containerRect.left;
  const bottom = containerRect.bottom - anchorRect.top + 4;

  return (
    <div
      className="link-preview-popup"
      style={{
        position: "absolute",
        left: Math.max(0, Math.min(left, containerRect.width - 450)),
        bottom,
        zIndex: 50,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {content === null ? (
        <div className="link-preview-empty">Note not found</div>
      ) : content.trim() === "" ? (
        <div className="link-preview-empty">Empty note</div>
      ) : (
        <div className="link-preview-content markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {processedContent!}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
