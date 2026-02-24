import { z } from "zod";
import * as api from "../api-client.js";
export function registerFolderTools(server) {
    server.tool("list_folders", "List all folders in the vault", {}, async () => {
        const folders = await api.listFolders();
        return {
            content: [{ type: "text", text: JSON.stringify(folders, null, 2) }],
        };
    });
    server.tool("create_folder", "Create a new folder", {
        name: z.string().describe("Folder name"),
        parentId: z.string().optional().describe("Parent folder ID (optional, omit for root)"),
    }, async ({ name, parentId }) => {
        const result = await api.createFolder(name, parentId);
        return {
            content: [{ type: "text", text: `Created folder: ${result.id}` }],
        };
    });
    server.tool("rename_folder", "Rename a folder", {
        folderId: z.string().describe("The folder ID"),
        name: z.string().describe("New folder name"),
    }, async ({ folderId, name }) => {
        await api.renameFolder(folderId, name);
        return {
            content: [{ type: "text", text: "Folder renamed" }],
        };
    });
    server.tool("move_folder", "Move a folder to a new parent", {
        folderId: z.string().describe("The folder ID"),
        parentId: z.string().optional().describe("New parent folder ID (omit to move to root)"),
    }, async ({ folderId, parentId }) => {
        await api.moveFolder(folderId, parentId);
        return {
            content: [{ type: "text", text: "Folder moved" }],
        };
    });
    server.tool("delete_folder", "Delete a folder (children are promoted to parent)", {
        folderId: z.string().describe("The folder ID"),
    }, async ({ folderId }) => {
        await api.deleteFolder(folderId);
        return {
            content: [{ type: "text", text: "Folder deleted" }],
        };
    });
}
