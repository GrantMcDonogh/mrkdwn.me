import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { client } from "../convex-client.js";
import { api } from "../../convex/_generated/api.js";

export function registerFolderTools(server: McpServer) {
  server.tool(
    "list_folders",
    "List all folders in a vault",
    { vaultId: { type: "string", description: "The vault ID" } },
    async ({ vaultId }) => {
      const folders = await client.query(api.folders.list, {
        vaultId: vaultId as any,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(folders, null, 2) }],
      };
    }
  );

  server.tool(
    "create_folder",
    "Create a new folder",
    {
      name: { type: "string", description: "Folder name" },
      vaultId: { type: "string", description: "The vault ID" },
      parentId: {
        type: "string",
        description: "Parent folder ID (optional, omit for root)",
      },
    },
    async ({ name, vaultId, parentId }) => {
      const id = await client.mutation(api.folders.create, {
        name: name as string,
        vaultId: vaultId as any,
        ...(parentId ? { parentId: parentId as any } : {}),
      });
      return {
        content: [{ type: "text" as const, text: `Created folder: ${id}` }],
      };
    }
  );

  server.tool(
    "rename_folder",
    "Rename a folder",
    {
      folderId: { type: "string", description: "The folder ID" },
      name: { type: "string", description: "New folder name" },
    },
    async ({ folderId, name }) => {
      await client.mutation(api.folders.rename, {
        id: folderId as any,
        name: name as string,
      });
      return {
        content: [{ type: "text" as const, text: "Folder renamed" }],
      };
    }
  );

  server.tool(
    "move_folder",
    "Move a folder to a new parent",
    {
      folderId: { type: "string", description: "The folder ID" },
      parentId: {
        type: "string",
        description: "New parent folder ID (omit to move to root)",
      },
    },
    async ({ folderId, parentId }) => {
      await client.mutation(api.folders.move, {
        id: folderId as any,
        ...(parentId ? { parentId: parentId as any } : {}),
      });
      return {
        content: [{ type: "text" as const, text: "Folder moved" }],
      };
    }
  );

  server.tool(
    "delete_folder",
    "Delete a folder (children are promoted to parent)",
    {
      folderId: { type: "string", description: "The folder ID" },
    },
    async ({ folderId }) => {
      await client.mutation(api.folders.remove, { id: folderId as any });
      return {
        content: [{ type: "text" as const, text: "Folder deleted" }],
      };
    }
  );
}
