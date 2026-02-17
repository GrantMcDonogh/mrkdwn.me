import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { client } from "../convex-client.js";
import { api } from "../../convex/_generated/api.js";

export function registerVaultTools(server: McpServer) {
  server.tool("list_vaults", "List all vaults for the authenticated user", {}, async () => {
    const vaults = await client.query(api.vaults.list);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(vaults, null, 2),
        },
      ],
    };
  });

  server.tool(
    "get_vault",
    "Get a vault by ID",
    { vaultId: { type: "string", description: "The vault ID" } },
    async ({ vaultId }) => {
      const vault = await client.query(api.vaults.get, { id: vaultId as any });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(vault, null, 2),
          },
        ],
      };
    }
  );
}
