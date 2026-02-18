import { useCallback } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useWorkspace } from "../../store/workspace";
import MarkdownEditor from "./MarkdownEditor";
import MarkdownPreview from "./MarkdownPreview";

interface Props {
  noteId: Id<"notes">;
  paneId: string;
  tabId: string;
  mode: "preview" | "edit";
}

export default function NoteView({ noteId, paneId, tabId, mode }: Props) {
  const [, dispatch] = useWorkspace();

  const switchToEdit = useCallback(() => {
    if (mode !== "edit") {
      dispatch({ type: "TOGGLE_TAB_MODE", paneId, tabId });
    }
  }, [mode, dispatch, paneId, tabId]);

  if (mode === "edit") {
    return <MarkdownEditor noteId={noteId} />;
  }

  return <MarkdownPreview noteId={noteId} onSwitchToEdit={switchToEdit} />;
}
