import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";
import { preprocessForPDF } from "../../utils/exportNoteToPDF";
import { positionPopup } from "./wikiLinks";

interface Props {
  content: string | null;
  mouseX: number;
  mouseY: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function LinkPreviewPopup({
  content,
  mouseX,
  mouseY,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const processedContent = useMemo(() => {
    if (!content || content.trim() === "") return null;
    const truncated =
      content.length > 1500 ? content.slice(0, 1500) + "..." : content;
    return preprocessForPDF(truncated);
  }, [content]);

  // Use a callback ref to position the popup after it mounts,
  // measuring actual size for accurate edge detection.
  const refCallback = (el: HTMLDivElement | null) => {
    if (el) positionPopup(el, mouseX, mouseY);
  };

  return createPortal(
    <div
      ref={refCallback}
      className="link-preview-popup"
      style={{
        position: "fixed",
        zIndex: 9999,
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
    </div>,
    document.body
  );
}
