import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

type Client = "claude-code" | "claude-desktop";

interface Props {
  apiKey?: string | null;
}

function getConfig(client: Client, apiKey: string): string {
  const entry = {
    mcpServers: {
      mrkdwn: {
        command: "npx",
        args: ["-y", "mrkdwn-mcp-server"],
        env: {
          MRKDWN_API_URL: "https://beaming-panda-407.convex.site",
          MRKDWN_API_KEY: apiKey,
        },
      },
    },
  };

  if (client === "claude-code") {
    return JSON.stringify(entry, null, 2);
  }

  // Claude Desktop wraps in the same shape
  return JSON.stringify(entry, null, 2);
}

function getFilePath(client: Client): string {
  if (client === "claude-code") {
    return ".claude/settings.json (project) or ~/.claude/settings.json (global)";
  }
  return "claude_desktop_config.json";
}

export default function McpSetup({ apiKey }: Props) {
  const [client, setClient] = useState<Client>("claude-code");
  const [copied, setCopied] = useState(false);

  const displayKey = apiKey || "mk_your_api_key_here";
  const config = getConfig(client, displayKey);

  async function handleCopy() {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-medium text-obsidian-text mb-2">
        <Terminal size={12} />
        MCP Server Setup
      </label>
      <p className="text-xs text-obsidian-text-muted mb-3">
        Connect your vault to Claude Code or Claude Desktop via the{" "}
        <a
          href="https://www.npmjs.com/package/mrkdwn-mcp-server"
          target="_blank"
          rel="noopener noreferrer"
          className="text-obsidian-accent hover:underline"
        >
          mrkdwn-mcp-server
        </a>{" "}
        npm package. Create an API key above, then add this config:
      </p>

      {/* Client tabs */}
      <div className="flex gap-1 mb-2">
        {(["claude-code", "claude-desktop"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setClient(c)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              client === c
                ? "bg-obsidian-accent text-white"
                : "bg-obsidian-bg border border-obsidian-border text-obsidian-text-muted hover:text-obsidian-text"
            }`}
          >
            {c === "claude-code" ? "Claude Code" : "Claude Desktop"}
          </button>
        ))}
      </div>

      {/* Config block */}
      <div className="relative">
        <pre className="bg-obsidian-bg border border-obsidian-border rounded p-3 text-xs text-obsidian-text font-mono overflow-x-auto max-h-48 select-all">
          {config}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded bg-obsidian-bg-secondary border border-obsidian-border hover:bg-obsidian-bg-tertiary text-obsidian-text-muted hover:text-obsidian-text transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check size={12} className="text-green-400" />
          ) : (
            <Copy size={12} />
          )}
        </button>
      </div>

      <p className="text-xs text-obsidian-text-muted mt-2">
        Add to{" "}
        <code className="bg-obsidian-bg px-1 py-0.5 rounded text-obsidian-text-faint">
          {getFilePath(client)}
        </code>
      </p>

      {!apiKey && (
        <p className="text-xs text-yellow-400/80 mt-1.5">
          Replace <code className="bg-obsidian-bg px-1 py-0.5 rounded">mk_your_api_key_here</code> with your vault API key.
        </p>
      )}
    </div>
  );
}
