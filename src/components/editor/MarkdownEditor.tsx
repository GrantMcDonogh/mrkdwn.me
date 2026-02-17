import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EditorView, lineNumbers, highlightActiveLine, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { bracketMatching } from "@codemirror/language";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { autocompletion } from "@codemirror/autocomplete";
import { livePreviewPlugin } from "./livePreview";
import {
  wikiLinkPlugin,
  wikiLinkCompletion,
  setWikiLinkNavigator,
  setNoteListProvider,
} from "./wikiLinks";
import { useWorkspace } from "../../store/workspace";

interface Props {
  noteId: Id<"notes">;
}

export default function MarkdownEditor({ noteId }: Props) {
  const [state, dispatch] = useWorkspace();
  const vaultId = state.vaultId!;
  const note = useQuery(api.notes.get, { id: noteId });
  const allNotes = useQuery(api.notes.list, { vaultId });
  const updateNote = useMutation(api.notes.update);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>("");

  const save = useCallback(
    (content: string) => {
      if (content !== lastSavedContentRef.current) {
        lastSavedContentRef.current = content;
        updateNote({ id: noteId, content });
      }
    },
    [noteId, updateNote]
  );

  const debouncedSave = useCallback(
    (content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => save(content), 500);
    },
    [save]
  );

  // Set up wiki link navigation
  useEffect(() => {
    setWikiLinkNavigator((title: string) => {
      if (!allNotes) return;
      const target = allNotes.find(
        (n) => n.title.toLowerCase() === title.toLowerCase()
      );
      if (target) {
        dispatch({ type: "OPEN_NOTE", noteId: target._id });
      }
    });
    setNoteListProvider(() => allNotes ?? []);
  }, [allNotes, dispatch]);

  // Create editor
  useEffect(() => {
    if (!containerRef.current || note === undefined) return;
    if (note === null) return;

    const initialContent = note.content;
    lastSavedContentRef.current = initialContent;

    const editorState = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        bracketMatching(),
        history(),
        markdown(),
        oneDark,
        livePreviewPlugin,
        wikiLinkPlugin,
        autocompletion({ override: [wikiLinkCompletion] }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            debouncedSave(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state: editorState, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        const content = view.state.doc.toString();
        save(content);
      }
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Sync external changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !note) return;
    const editorContent = view.state.doc.toString();
    if (editorContent !== note.content && !view.hasFocus) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: note.content,
        },
      });
      lastSavedContentRef.current = note.content;
    }
  }, [note]);

  if (note === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-obsidian-text-muted">Loading...</p>
      </div>
    );
  }

  if (note === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-obsidian-text-muted">Note not found</p>
      </div>
    );
  }

  return <div ref={containerRef} className="flex-1 overflow-hidden" />;
}
