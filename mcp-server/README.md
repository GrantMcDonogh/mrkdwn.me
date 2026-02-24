# mrkdwn.me MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that gives LLMs direct access to your mrkdwn.me vault. Use it with Claude Code, Claude Desktop, or any MCP-compatible client to read, create, search, and manage notes and folders.

## Prerequisites

- Node.js 18+
- A mrkdwn.me account with at least one vault
- A vault API key (created in the app's Settings dialog)

## Quick Start

```bash
# 1. Build the server
cd mcp-server
npm install
npm run build

# 2. Test it works
MRKDWN_API_URL=https://beaming-panda-407.convex.site \
MRKDWN_API_KEY=mk_your_key_here \
node dist/index.js
```

## Getting an API Key

1. Open [app.mrkdwn.me](https://app.mrkdwn.me) and select a vault.
2. Click the **Settings** gear icon in the toolbar.
3. Scroll to **Vault API Keys**.
4. Enter a name (e.g. "Claude Code") and click **Create**.
5. Copy the key — it starts with `mk_` and is only shown once.

## Configuration

### Claude Code

Add to your project's `.claude/settings.json` or global `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "mrkdwn": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "MRKDWN_API_URL": "https://beaming-panda-407.convex.site",
        "MRKDWN_API_KEY": "mk_your_api_key_here"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "mrkdwn": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "MRKDWN_API_URL": "https://beaming-panda-407.convex.site",
        "MRKDWN_API_KEY": "mk_your_api_key_here"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MRKDWN_API_URL` | Yes | The Convex site URL for your deployment |
| `MRKDWN_API_KEY` | Yes | Your vault-scoped API key (starts with `mk_`) |

## Available Tools

### Vault

| Tool | Description |
|------|-------------|
| `get_vault` | Get vault name and creation date |

### Folders

| Tool | Description |
|------|-------------|
| `list_folders` | List all folders |
| `create_folder` | Create a folder (params: `name`, `parentId?`) |
| `rename_folder` | Rename a folder (params: `folderId`, `name`) |
| `move_folder` | Move a folder (params: `folderId`, `parentId?`) |
| `delete_folder` | Delete a folder — children are promoted to parent (params: `folderId`) |

### Notes

| Tool | Description |
|------|-------------|
| `list_notes` | List all notes (titles and IDs, no content) |
| `get_note` | Get a note's full content (params: `noteId`) |
| `create_note` | Create a note (params: `title`, `folderId?`) |
| `update_note` | Update note content (params: `noteId`, `content`) |
| `rename_note` | Rename a note — updates wiki link references (params: `noteId`, `title`) |
| `move_note` | Move a note to a folder (params: `noteId`, `folderId?`) |
| `delete_note` | Delete a note (params: `noteId`) |
| `search_notes` | Full-text search (params: `query`) |
| `get_backlinks` | Get notes linking to a note (params: `noteId`) |
| `get_unlinked_mentions` | Get unlinked title mentions (params: `noteId`) |

## Security

- Each API key is scoped to a single vault. The server cannot access other vaults.
- Only the SHA-256 hash of the key is stored server-side. The raw key is shown once at creation.
- Keys can be revoked instantly from the Settings UI.

## Development

```bash
npm run dev      # Watch mode (tsc --watch)
npm run build    # Production build
npm start        # Run the server
```
