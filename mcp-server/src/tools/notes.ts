import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { client } from "../convex-client.js";
import { api } from "../../convex/_generated/api.js";

export function registerNoteTools(server: McpServer) {
  server.tool(
    "list_notes",
    "List all notes in a vault",
    { vaultId: { type: "string", description: "The vault ID" } },
    async ({ vaultId }) => {
      const notes = await client.query(api.notes.list, {
        vaultId: vaultId as any,
      });
      // Return titles and IDs without full content to save tokens
      const summary = notes.map((n: any) => ({
        _id: n._id,
        title: n.title,
        folderId: n.folderId,
        updatedAt: n.updatedAt,
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  server.tool(
    "get_note",
    "Get a note's full content",
    { noteId: { type: "string", description: "The note ID" } },
    async ({ noteId }) => {
      const note = await client.query(api.notes.get, { id: noteId as any });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }],
      };
    }
  );

  server.tool(
    "create_note",
    "Create a new note",
    {
      title: { type: "string", description: "Note title" },
      vaultId: { type: "string", description: "The vault ID" },
      folderId: {
        type: "string",
        description: "Folder ID (optional, omit for root)",
      },
    },
    async ({ title, vaultId, folderId }) => {
      const id = await client.mutation(api.notes.create, {
        title: title as string,
        vaultId: vaultId as any,
        ...(folderId ? { folderId: folderId as any } : {}),
      });
      return {
        content: [{ type: "text" as const, text: `Created note: ${id}` }],
      };
    }
  );

  server.tool(
    "update_note",
    "Update a note's content",
    {
      noteId: { type: "string", description: "The note ID" },
      content: { type: "string", description: "New markdown content" },
    },
    async ({ noteId, content }) => {
      await client.mutation(api.notes.update, {
        id: noteId as any,
        content: content as string,
      });
      return {
        content: [{ type: "text" as const, text: "Note updated" }],
      };
    }
  );

  server.tool(
    "rename_note",
    "Rename a note (also updates wiki link references)",
    {
      noteId: { type: "string", description: "The note ID" },
      title: { type: "string", description: "New title" },
    },
    async ({ noteId, title }) => {
      await client.mutation(api.notes.rename, {
        id: noteId as any,
        title: title as string,
      });
      return {
        content: [{ type: "text" as const, text: "Note renamed" }],
      };
    }
  );

  server.tool(
    "move_note",
    "Move a note to a folder",
    {
      noteId: { type: "string", description: "The note ID" },
      folderId: {
        type: "string",
        description: "Target folder ID (omit to move to root)",
      },
    },
    async ({ noteId, folderId }) => {
      await client.mutation(api.notes.move, {
        id: noteId as any,
        ...(folderId ? { folderId: folderId as any } : {}),
      });
      return {
        content: [{ type: "text" as const, text: "Note moved" }],
      };
    }
  );

  server.tool(
    "delete_note",
    "Delete a note",
    { noteId: { type: "string", description: "The note ID" } },
    async ({ noteId }) => {
      await client.mutation(api.notes.remove, { id: noteId as any });
      return {
        content: [{ type: "text" as const, text: "Note deleted" }],
      };
    }
  );

  server.tool(
    "search_notes",
    "Full-text search across vault notes",
    {
      vaultId: { type: "string", description: "The vault ID" },
      query: { type: "string", description: "Search query" },
    },
    async ({ vaultId, query }) => {
      const results = await client.query(api.notes.search, {
        vaultId: vaultId as any,
        query: query as string,
      });
      const summary = results.map((n: any) => ({
        _id: n._id,
        title: n.title,
        preview: n.content.slice(0, 200),
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  server.tool(
    "get_backlinks",
    "Get notes that link to a given note",
    { noteId: { type: "string", description: "The note ID" } },
    async ({ noteId }) => {
      const backlinks = await client.query(api.notes.getBacklinks, {
        noteId: noteId as any,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(backlinks, null, 2) }],
      };
    }
  );

  server.tool(
    "get_unlinked_mentions",
    "Get notes that mention a note's title without linking",
    { noteId: { type: "string", description: "The note ID" } },
    async ({ noteId }) => {
      const mentions = await client.query(api.notes.getUnlinkedMentions, {
        noteId: noteId as any,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(mentions, null, 2) }],
      };
    }
  );
}
