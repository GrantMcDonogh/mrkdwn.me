#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerVaultTools } from "./tools/vaults.js";
import { registerFolderTools } from "./tools/folders.js";
import { registerNoteTools } from "./tools/notes.js";
const server = new McpServer({
    name: "mrkdwn-me",
    version: "0.1.0",
});
// Register all tools
registerVaultTools(server);
registerFolderTools(server);
registerNoteTools(server);
// Start with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
