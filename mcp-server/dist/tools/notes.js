import { z } from "zod";
import * as api from "../api-client.js";
export function registerNoteTools(server) {
    server.tool("list_notes", "List all notes in the vault", {}, async () => {
        const notes = await api.listNotes();
        // Return titles and IDs without full content to save tokens
        const summary = notes.map((n) => ({
            _id: n._id,
            title: n.title,
            folderId: n.folderId,
            updatedAt: n.updatedAt,
        }));
        return {
            content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        };
    });
    server.tool("get_note", "Get a note's full content", { noteId: z.string().describe("The note ID") }, async ({ noteId }) => {
        const note = await api.getNote(noteId);
        return {
            content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        };
    });
    server.tool("create_note", "Create a new note", {
        title: z.string().describe("Note title"),
        folderId: z.string().optional().describe("Folder ID (optional, omit for root)"),
    }, async ({ title, folderId }) => {
        const result = await api.createNote(title, folderId);
        return {
            content: [{ type: "text", text: `Created note: ${result.id}` }],
        };
    });
    server.tool("update_note", "Update a note's content", {
        noteId: z.string().describe("The note ID"),
        content: z.string().describe("New markdown content"),
    }, async ({ noteId, content }) => {
        await api.updateNote(noteId, content);
        return {
            content: [{ type: "text", text: "Note updated" }],
        };
    });
    server.tool("rename_note", "Rename a note (also updates wiki link references)", {
        noteId: z.string().describe("The note ID"),
        title: z.string().describe("New title"),
    }, async ({ noteId, title }) => {
        await api.renameNote(noteId, title);
        return {
            content: [{ type: "text", text: "Note renamed" }],
        };
    });
    server.tool("move_note", "Move a note to a folder", {
        noteId: z.string().describe("The note ID"),
        folderId: z.string().optional().describe("Target folder ID (omit to move to root)"),
    }, async ({ noteId, folderId }) => {
        await api.moveNote(noteId, folderId);
        return {
            content: [{ type: "text", text: "Note moved" }],
        };
    });
    server.tool("delete_note", "Delete a note", { noteId: z.string().describe("The note ID") }, async ({ noteId }) => {
        await api.deleteNote(noteId);
        return {
            content: [{ type: "text", text: "Note deleted" }],
        };
    });
    server.tool("search_notes", "Full-text search across vault notes", {
        query: z.string().describe("Search query"),
    }, async ({ query }) => {
        const results = await api.searchNotes(query);
        const summary = results.map((n) => ({
            _id: n._id,
            title: n.title,
            preview: n.content?.slice(0, 200),
        }));
        return {
            content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        };
    });
    server.tool("get_backlinks", "Get notes that link to a given note", { noteId: z.string().describe("The note ID") }, async ({ noteId }) => {
        const backlinks = await api.getBacklinks(noteId);
        return {
            content: [{ type: "text", text: JSON.stringify(backlinks, null, 2) }],
        };
    });
    server.tool("get_unlinked_mentions", "Get notes that mention a note's title without linking", { noteId: z.string().describe("The note ID") }, async ({ noteId }) => {
        const mentions = await api.getUnlinkedMentions(noteId);
        return {
            content: [{ type: "text", text: JSON.stringify(mentions, null, 2) }],
        };
    });
}
