const apiUrl = process.env.MRKDWN_API_URL;
if (!apiUrl) {
    throw new Error("MRKDWN_API_URL environment variable is required");
}
const apiKey = process.env.MRKDWN_API_KEY;
if (!apiKey) {
    throw new Error("MRKDWN_API_KEY environment variable is required");
}
const baseUrl = apiUrl.replace(/\/$/, "");
async function request(method, path, body) {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json());
    if (!json.ok) {
        throw new Error(json.error ?? `API error ${res.status}`);
    }
    return json.data;
}
// --- Vault ---
export async function getVault() {
    return request("GET", "/api/v1/vault");
}
// --- Folders ---
export async function listFolders() {
    return request("GET", "/api/v1/folders");
}
export async function createFolder(name, parentId) {
    return request("POST", "/api/v1/folders", { name, parentId });
}
export async function renameFolder(id, name) {
    await request("PATCH", "/api/v1/folders/rename", { id, name });
}
export async function moveFolder(id, parentId) {
    await request("PATCH", "/api/v1/folders/move", { id, parentId });
}
export async function deleteFolder(id) {
    await request("DELETE", `/api/v1/folders?id=${encodeURIComponent(id)}`);
}
// --- Notes ---
export async function listNotes() {
    return request("GET", "/api/v1/notes");
}
export async function getNote(id) {
    return request("GET", `/api/v1/notes/get?id=${encodeURIComponent(id)}`);
}
export async function createNote(title, folderId) {
    return request("POST", "/api/v1/notes", { title, folderId });
}
export async function updateNote(id, content) {
    await request("PATCH", "/api/v1/notes/update", { id, content });
}
export async function renameNote(id, title) {
    await request("PATCH", "/api/v1/notes/rename", { id, title });
}
export async function moveNote(id, folderId) {
    await request("PATCH", "/api/v1/notes/move", { id, folderId });
}
export async function deleteNote(id) {
    await request("DELETE", `/api/v1/notes?id=${encodeURIComponent(id)}`);
}
export async function searchNotes(query) {
    return request("GET", `/api/v1/notes/search?query=${encodeURIComponent(query)}`);
}
export async function getBacklinks(noteId) {
    return request("GET", `/api/v1/notes/backlinks?noteId=${encodeURIComponent(noteId)}`);
}
export async function getUnlinkedMentions(noteId) {
    return request("GET", `/api/v1/notes/unlinked-mentions?noteId=${encodeURIComponent(noteId)}`);
}
