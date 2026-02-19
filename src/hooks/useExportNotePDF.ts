import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { exportNoteToPDF } from "../utils/exportNoteToPDF";
import type { Id } from "../../convex/_generated/dataModel";

export function useExportNotePDF() {
  const client = useConvex();

  async function exportPDF(noteId: Id<"notes">) {
    const note = await client.query(api.notes.get, { id: noteId });
    if (!note) return;
    await exportNoteToPDF(note.title, note.content ?? "");
  }

  return exportPDF;
}
