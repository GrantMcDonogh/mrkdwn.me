import * as api from "../api-client.js";
export function registerVaultTools(server) {
    server.tool("get_vault", "Get info about the vault this API key is scoped to", {}, async () => {
        const vault = await api.getVault();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(vault, null, 2),
                },
            ],
        };
    });
}
