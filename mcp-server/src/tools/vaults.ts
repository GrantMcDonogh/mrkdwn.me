import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as api from "../api-client.js";

export function registerVaultTools(server: McpServer) {
  server.tool("get_vault", "Get info about the vault this API key is scoped to", {}, async () => {
    const vault = await api.getVault();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(vault, null, 2),
        },
      ],
    };
  });
}
