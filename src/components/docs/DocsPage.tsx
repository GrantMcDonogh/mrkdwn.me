import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

// --- Types ---

interface Param {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface Endpoint {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  params?: Param[];
  body?: Param[];
  curl: string;
  response: string;
}

interface Section {
  id: string;
  title: string;
  endpoints: Endpoint[];
}

// --- Data ---

const BASE_URL = "https://<your-deployment>.convex.site";

export const sections: Section[] = [
  {
    id: "vault",
    title: "Vault",
    endpoints: [
      {
        id: "get-vault",
        method: "GET",
        path: "/api/v1/vault",
        summary: "Get vault info. Returns the vault name and creation date.",
        curl: `curl ${BASE_URL}/api/v1/vault \\
  -H "Authorization: Bearer mk_your_api_key"`,
        response: `{
  "ok": true,
  "data": {
    "name": "My Vault",
    "createdAt": 1700000000000
  }
}`,
      },
    ],
  },
  {
    id: "folders",
    title: "Folders",
    endpoints: [
      {
        id: "list-folders",
        method: "GET",
        path: "/api/v1/folders",
        summary: "List all folders in the vault.",
        curl: `curl ${BASE_URL}/api/v1/folders \\
  -H "Authorization: Bearer mk_your_api_key"`,
        response: `{
  "ok": true,
  "data": [
    {
      "_id": "abc123",
      "name": "Projects",
      "vaultId": "vault_id",
      "parentId": null,
      "order": 0
    }
  ]
}`,
      },
      {
        id: "create-folder",
        method: "POST",
        path: "/api/v1/folders",
        summary: "Create a new folder.",
        body: [
          { name: "name", type: "string", required: true, description: "Folder name" },
          { name: "parentId", type: "string", required: false, description: "Parent folder ID (omit for root)" },
        ],
        curl: `curl -X POST ${BASE_URL}/api/v1/folders \\
  -H "Authorization: Bearer mk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "New Folder"}'`,
        response: `{
  "ok": true,
  "data": {
    "id": "new_folder_id"
  }
}`,
      },
      {
        id: "rename-folder",
        method: "PATCH",
        path: "/api/v1/folders/rename",
        summary: "Rename a folder.",
        body: [
          { name: "id", type: "string", required: true, description: "Folder ID" },
          { name: "name", type: "string", required: true, description: "New folder name" },
        ],
        curl: `curl -X PATCH ${BASE_URL}/api/v1/folders/rename \\
  -H "Authorization: Bearer mk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"id": "folder_id", "name": "Renamed"}'`,
        response: `{
  "ok": true,
  "data": null
}`,
      },
      {
        id: "move-folder",
        method: "PATCH",
        path: "/api/v1/folders/move",
        summary: "Move a folder to a new parent. Omit parentId to move to root.",
        body: [
          { name: "id", type: "string", required: true, description: "Folder ID" },
          { name: "parentId", type: "string", required: false, description: "New parent folder ID (omit for root)" },
        ],
        curl: `curl -X PATCH ${BASE_URL}/api/v1/folders/move \\
  -H "Authorization: Bearer mk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"id": "folder_id", "parentId": "target_folder_id"}'`,
        response: `{
  "ok": true,
  "data": null
}`,
      },
      {
        id: "delete-folder",
        method: "DELETE",
        path: "/api/v1/folders",
        summary: "Delete a folder. Child folders and notes are promoted to the deleted folder's parent.",
        params: [
          { name: "id", type: "string", required: true, description: "Folder ID" },
        ],
        curl: `curl -X DELETE "${BASE_URL}/api/v1/folders?id=folder_id" \\
  -H "Authorization: Bearer mk_your_api_key"`,
        response: `{
  "ok": true,
  "data": null
}`,
      },
    ],
  },
  {
    id: "notes",
    title: "Notes",
    endpoints: [
      {
        id: "list-notes",
        method: "GET",
        path: "/api/v1/notes",
        summary: "List all notes in the vault.",
        curl: `curl ${BASE_URL}/api/v1/notes \\
  -H "Authorization: Bearer mk_your_api_key"`,
        response: `{
  "ok": true,
  "data": [
    {
      "_id": "note_id",
      "title": "My Note",
      "content": "# Hello\\nNote content here.",
      "vaultId": "vault_id",
      "folderId": "folder_id",
      "order": 0,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ]
}`,
      },
      {
        id: "get-note",
        method: "GET",
        path: "/api/v1/notes/get",
        summary: "Get a single note by ID, including its full content.",
        params: [
          { name: "id", type: "string", required: true, description: "Note ID" },
        ],
        curl: `curl "${BASE_URL}/api/v1/notes/get?id=note_id" \\
  -H "Authorization: Bearer mk_your_api_key"`,
        response: `{
  "ok": true,
  "data": {
    "_id": "note_id",
    "title": "My Note",
    "content": "# Hello\\nNote content here.",
    "vaultId": "vault_id",
    "folderId": "folder_id",
    "order": 0,
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000
  }
}`,
      },
      {
        id: "search-notes",
        method: "GET",
        path: "/api/v1/notes/search",
        summary: "Full-text search across note titles and content. Returns up to 20 results.",
        params: [
          { name: "query", type: "string", required: true, description: "Search query" },
        ],
        curl: `curl "${BASE_URL}/api/v1/notes/search?query=hello" \\
  -H "Authorization: Bearer mk_your_api_key"`,
        response: `{
  "ok": true,
  "data": [
    {
      "_id": "note_id",
      "title": "My Note",
      "content": "# Hello\\nNote content here.",
      "vaultId": "vault_id",
      "folderId": "folder_id",
      "order": 0,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ]
}`,
      },
      {
        id: "get-backlinks",
        method: "GET",
        path: "/api/v1/notes/backlinks",
        summary: "Get all notes that link to a given note via [[wiki links]].",
        params: [
          { name: "noteId", type: "string", required: true, description: "Target note ID" },
        ],
        curl: `curl "${BASE_URL}/api/v1/notes/backlinks?noteId=note_id" \\
  -H "Authorization: Bearer mk_your_api_key"`,
        response: `{
  "ok": true,
  "data": [
    {
      "noteId": "linking_note_id",
      "noteTitle": "Other Note",
      "context": "See [[My Note]] for details."
    }
  ]
}`,
      },
      {
        id: "get-unlinked-mentions",
        method: "GET",
        path: "/api/v1/notes/unlinked-mentions",
        summary:
          "Get notes that mention a note's title in plain text but don't use a [[wiki link]].",
        params: [
          { name: "noteId", type: "string", required: true, description: "Target note ID" },
        ],
        curl: `curl "${BASE_URL}/api/v1/notes/unlinked-mentions?noteId=note_id" \\
  -H "Authorization: Bearer mk_your_api_key"`,
        response: `{
  "ok": true,
  "data": [
    {
      "noteId": "mentioning_note_id",
      "noteTitle": "Some Note",
      "context": "I was reading about My Note yesterday."
    }
  ]
}`,
      },
      {
        id: "create-note",
        method: "POST",
        path: "/api/v1/notes",
        summary: "Create a new note. Content starts empty.",
        body: [
          { name: "title", type: "string", required: true, description: "Note title" },
          { name: "folderId", type: "string", required: false, description: "Folder ID (omit for root)" },
        ],
        curl: `curl -X POST ${BASE_URL}/api/v1/notes \\
  -H "Authorization: Bearer mk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "New Note"}'`,
        response: `{
  "ok": true,
  "data": {
    "id": "new_note_id"
  }
}`,
      },
      {
        id: "update-note",
        method: "PATCH",
        path: "/api/v1/notes/update",
        summary: "Update a note's content (full replace).",
        body: [
          { name: "id", type: "string", required: true, description: "Note ID" },
          { name: "content", type: "string", required: true, description: "New markdown content" },
        ],
        curl: `curl -X PATCH ${BASE_URL}/api/v1/notes/update \\
  -H "Authorization: Bearer mk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"id": "note_id", "content": "# Updated\\nNew content."}'`,
        response: `{
  "ok": true,
  "data": null
}`,
      },
      {
        id: "rename-note",
        method: "PATCH",
        path: "/api/v1/notes/rename",
        summary:
          "Rename a note. All [[wiki links]] referencing the old title are automatically updated across the vault.",
        body: [
          { name: "id", type: "string", required: true, description: "Note ID" },
          { name: "title", type: "string", required: true, description: "New title" },
        ],
        curl: `curl -X PATCH ${BASE_URL}/api/v1/notes/rename \\
  -H "Authorization: Bearer mk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"id": "note_id", "title": "Better Title"}'`,
        response: `{
  "ok": true,
  "data": null
}`,
      },
      {
        id: "move-note",
        method: "PATCH",
        path: "/api/v1/notes/move",
        summary: "Move a note to a different folder. Omit folderId to move to root.",
        body: [
          { name: "id", type: "string", required: true, description: "Note ID" },
          { name: "folderId", type: "string", required: false, description: "Target folder ID (omit for root)" },
        ],
        curl: `curl -X PATCH ${BASE_URL}/api/v1/notes/move \\
  -H "Authorization: Bearer mk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"id": "note_id", "folderId": "target_folder_id"}'`,
        response: `{
  "ok": true,
  "data": null
}`,
      },
      {
        id: "delete-note",
        method: "DELETE",
        path: "/api/v1/notes",
        summary: "Permanently delete a note.",
        params: [
          { name: "id", type: "string", required: true, description: "Note ID" },
        ],
        curl: `curl -X DELETE "${BASE_URL}/api/v1/notes?id=note_id" \\
  -H "Authorization: Bearer mk_your_api_key"`,
        response: `{
  "ok": true,
  "data": null
}`,
      },
    ],
  },
];

export const allEndpoints = sections.flatMap((s) => s.endpoints);

// --- Helpers ---

const methodColors: Record<string, string> = {
  GET: "bg-green-500/15 text-green-400 border-green-500/30",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  PATCH: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-bold rounded border font-mono ${methodColors[method] ?? ""}`}
    >
      {method}
    </span>
  );
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`relative group ${className ?? ""}`}>
      <pre className="bg-obsidian-bg rounded-lg border border-obsidian-border p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-obsidian-text-muted font-mono whitespace-pre">{children}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-obsidian-bg-tertiary border border-obsidian-border text-obsidian-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-obsidian-text"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function ParamTable({ title, params }: { title: string; params: Param[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-obsidian-text-muted mb-2 uppercase tracking-wide">{title}</p>
      <div className="border border-obsidian-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-obsidian-bg-tertiary/50 text-left text-xs text-obsidian-text-muted">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Required</th>
              <th className="px-3 py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.name} className="border-t border-obsidian-border">
                <td className="px-3 py-2 font-mono text-obsidian-accent text-xs">{p.name}</td>
                <td className="px-3 py-2 font-mono text-obsidian-text-muted text-xs">{p.type}</td>
                <td className="px-3 py-2 text-xs">
                  {p.required ? (
                    <span className="text-yellow-400">Yes</span>
                  ) : (
                    <span className="text-obsidian-text-faint">No</span>
                  )}
                </td>
                <td className="px-3 py-2 text-obsidian-text-muted text-xs">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div id={endpoint.id} className="scroll-mt-20 border border-obsidian-border rounded-lg bg-obsidian-bg-secondary/50">
      <div className="px-5 py-4 border-b border-obsidian-border flex items-center gap-3 flex-wrap">
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono text-obsidian-text">{endpoint.path}</code>
      </div>
      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-obsidian-text-muted">{endpoint.summary}</p>
        {endpoint.params && <ParamTable title="Query Parameters" params={endpoint.params} />}
        {endpoint.body && <ParamTable title="Request Body (JSON)" params={endpoint.body} />}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-obsidian-text-muted mb-2 uppercase tracking-wide">Example Request</p>
            <CodeBlock>{endpoint.curl}</CodeBlock>
          </div>
          <div>
            <p className="text-xs font-medium text-obsidian-text-muted mb-2 uppercase tracking-wide">Example Response</p>
            <CodeBlock>{endpoint.response}</CodeBlock>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sidebar ---

function Sidebar({ activeId }: { activeId: string }) {
  return (
    <nav className="space-y-4">
      <a href="#authentication" className={`block text-xs hover:text-obsidian-text transition-colors ${activeId === "authentication" ? "text-obsidian-accent" : "text-obsidian-text-muted"}`}>
        Authentication
      </a>
      <a href="#response-format" className={`block text-xs hover:text-obsidian-text transition-colors ${activeId === "response-format" ? "text-obsidian-accent" : "text-obsidian-text-muted"}`}>
        Response Format
      </a>
      {sections.map((s) => (
        <div key={s.id}>
          <a
            href={`#${s.id}`}
            className={`block text-xs font-medium hover:text-obsidian-text transition-colors ${activeId === s.id ? "text-obsidian-accent" : "text-obsidian-text-muted"}`}
          >
            {s.title}
          </a>
          <div className="ml-3 mt-1 space-y-1">
            {s.endpoints.map((e) => (
              <a
                key={e.id}
                href={`#${e.id}`}
                className={`flex items-center gap-2 text-xs hover:text-obsidian-text transition-colors ${activeId === e.id ? "text-obsidian-accent" : "text-obsidian-text-faint"}`}
              >
                <MethodBadge method={e.method} />
                <span className="font-mono truncate">{e.path}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
      <a href="#errors" className={`block text-xs hover:text-obsidian-text transition-colors ${activeId === "errors" ? "text-obsidian-accent" : "text-obsidian-text-muted"}`}>
        Error Codes
      </a>
    </nav>
  );
}

// --- Page ---

export default function DocsPage() {
  const [activeId, setActiveId] = useState("authentication");

  useEffect(() => {
    const ids = ["authentication", "response-format", ...sections.map((s) => s.id), ...allEndpoints.map((e) => e.id), "errors"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-bg text-obsidian-text scroll-smooth">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-obsidian-bg/80 backdrop-blur-md border-b border-obsidian-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-tight">mrkdwn.me</span>
            <span className="text-xs text-obsidian-text-faint">/</span>
            <span className="text-sm text-obsidian-text-muted">API Reference</span>
          </div>
          <Link
            to="/"
            className="text-xs text-obsidian-accent hover:underline"
          >
            Back to app
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-4 border-r border-obsidian-border">
          <Sidebar activeId={activeId} />
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 py-8 space-y-12">
          {/* Intro */}
          <div>
            <h1 className="text-2xl font-bold mb-2">API Reference</h1>
            <p className="text-sm text-obsidian-text-muted max-w-2xl">
              The mrkdwn.me REST API lets you programmatically manage your vaults, folders, and
              notes. All endpoints use API key authentication and return JSON.
            </p>
          </div>

          {/* Authentication */}
          <section id="authentication" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold">Authentication</h2>
            <p className="text-sm text-obsidian-text-muted max-w-2xl">
              All API requests require a vault API key. Generate one in{" "}
              <strong className="text-obsidian-text">Settings &rarr; Vault API Keys</strong> inside the app.
            </p>
            <p className="text-sm text-obsidian-text-muted max-w-2xl">
              Pass your key in the <code className="text-obsidian-accent bg-obsidian-bg-tertiary px-1.5 py-0.5 rounded text-xs">Authorization</code> header:
            </p>
            <CodeBlock>{`Authorization: Bearer mk_your_api_key`}</CodeBlock>
            <p className="text-sm text-obsidian-text-muted max-w-2xl">
              Each API key is scoped to a single vault. The key determines which vault you're operating on &mdash; there's no need to specify a vault ID in requests.
            </p>
          </section>

          {/* Base URL */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Base URL</h2>
            <p className="text-sm text-obsidian-text-muted max-w-2xl">
              All API endpoints are served from your Convex deployment:
            </p>
            <CodeBlock>{`https://beaming-panda-407.convex.site`}</CodeBlock>
          </section>

          {/* Response format */}
          <section id="response-format" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold">Response Format</h2>
            <p className="text-sm text-obsidian-text-muted max-w-2xl">
              All responses are JSON with a consistent envelope:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-green-400 mb-2">Success</p>
                <CodeBlock>{`{
  "ok": true,
  "data": { ... }
}`}</CodeBlock>
              </div>
              <div>
                <p className="text-xs font-medium text-red-400 mb-2">Error</p>
                <CodeBlock>{`{
  "ok": false,
  "error": "Error message"
}`}</CodeBlock>
              </div>
            </div>
          </section>

          {/* Endpoint sections */}
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20 space-y-6">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.endpoints.map((endpoint) => (
                <EndpointCard key={endpoint.id} endpoint={endpoint} />
              ))}
            </section>
          ))}

          {/* Error codes */}
          <section id="errors" className="scroll-mt-20 space-y-4">
            <h2 className="text-lg font-semibold">Error Codes</h2>
            <div className="border border-obsidian-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-obsidian-bg-tertiary/50 text-left text-xs text-obsidian-text-muted">
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["200", "Success"],
                    ["201", "Created (returned by POST endpoints)"],
                    ["400", "Bad request — missing or invalid parameters"],
                    ["401", "Unauthorized — missing or invalid API key"],
                    ["404", "Resource not found or doesn't belong to the vault"],
                  ].map(([code, desc]) => (
                    <tr key={code} className="border-t border-obsidian-border">
                      <td className="px-4 py-2.5 font-mono text-obsidian-accent">{code}</td>
                      <td className="px-4 py-2.5 text-obsidian-text-muted">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-obsidian-border pt-6 pb-12">
            <p className="text-xs text-obsidian-text-faint">
              mrkdwn.me API v1 &mdash; Questions? Reach out via the app.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
