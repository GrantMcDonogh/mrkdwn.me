const apiUrl = process.env.MRKDWN_API_URL;
if (!apiUrl) {
  throw new Error("MRKDWN_API_URL environment variable is required");
}

const apiKey = process.env.MRKDWN_API_KEY;
if (!apiKey) {
  throw new Error("MRKDWN_API_KEY environment variable is required");
}

const baseUrl = apiUrl.replace(/\/$/, "");

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json()) as { ok: boolean; data: T; error?: string };
  if (!json.ok) {
    throw new Error(json.error ?? `API error ${res.status}`);
  }
  return json.data;
}

// --- Vault ---

export async function getVault(): Promise<{ name: string; createdAt: number }> {
  return request("GET", "/api/v1/vault");
}

// --- Folders ---

export async function listFolders(): Promise<unknown[]> {
  return request("GET", "/api/v1/folders");
}

export async function createFolder(name: string, parentId?: string): Promise<{ id: string }> {
  return request("POST", "/api/v1/folders", { name, parentId });
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await request("PATCH", "/api/v1/folders/rename", { id, name });
}

export async function moveFolder(id: string, parentId?: string): Promise<void> {
  await request("PATCH", "/api/v1/folders/move", { id, parentId });
}

export async function deleteFolder(id: string): Promise<void> {
  await request("DELETE", `/api/v1/folders?id=${encodeURIComponent(id)}`);
}

// --- Notes ---

export async function listNotes(): Promise<unknown[]> {
  return request("GET", "/api/v1/notes");
}

export async function getNote(id: string): Promise<unknown> {
  return request("GET", `/api/v1/notes/get?id=${encodeURIComponent(id)}`);
}

export async function createNote(title: string, folderId?: string): Promise<{ id: string }> {
  return request("POST", "/api/v1/notes", { title, folderId });
}

export async function updateNote(id: string, content: string): Promise<void> {
  await request("PATCH", "/api/v1/notes/update", { id, content });
}

export async function renameNote(id: string, title: string): Promise<void> {
  await request("PATCH", "/api/v1/notes/rename", { id, title });
}

export async function moveNote(id: string, folderId?: string): Promise<void> {
  await request("PATCH", "/api/v1/notes/move", { id, folderId });
}

export async function deleteNote(id: string): Promise<void> {
  await request("DELETE", `/api/v1/notes?id=${encodeURIComponent(id)}`);
}

export async function searchNotes(query: string): Promise<unknown[]> {
  return request("GET", `/api/v1/notes/search?query=${encodeURIComponent(query)}`);
}

export async function getBacklinks(noteId: string): Promise<unknown[]> {
  return request("GET", `/api/v1/notes/backlinks?noteId=${encodeURIComponent(noteId)}`);
}

export async function getUnlinkedMentions(noteId: string): Promise<unknown[]> {
  return request("GET", `/api/v1/notes/unlinked-mentions?noteId=${encodeURIComponent(noteId)}`);
}
