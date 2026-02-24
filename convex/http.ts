import { httpRouter } from "convex/server";
import { chat } from "./chat";
import { chatEdit } from "./chatEdit";
import { onboarding } from "./onboarding";
import { testKey } from "./testKey";
import {
  listVaults, getVault, createVault, renameVault, deleteVault,
} from "./apiVaults";
import {
  listFolders, createFolder, renameFolder, moveFolder, deleteFolder,
} from "./apiFolders";
import {
  listNotes, getNote, searchNotes, getBacklinks, getUnlinkedMentions,
  createNote, updateNote, renameNote, moveNote, deleteNote,
} from "./apiNotes";

const http = httpRouter();

http.route({
  path: "/api/chat",
  method: "POST",
  handler: chat,
});

// CORS preflight for chat
http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: chat,
});

http.route({
  path: "/api/chat-edit",
  method: "POST",
  handler: chatEdit,
});

// CORS preflight for chat-edit
http.route({
  path: "/api/chat-edit",
  method: "OPTIONS",
  handler: chatEdit,
});

http.route({
  path: "/api/onboarding",
  method: "POST",
  handler: onboarding,
});

// CORS preflight for onboarding
http.route({
  path: "/api/onboarding",
  method: "OPTIONS",
  handler: onboarding,
});

http.route({
  path: "/api/test-openrouter-key",
  method: "POST",
  handler: testKey,
});

// CORS preflight for test-openrouter-key
http.route({
  path: "/api/test-openrouter-key",
  method: "OPTIONS",
  handler: testKey,
});

// --- Public REST API v1 ---

// Vaults
http.route({ path: "/api/v1/vaults", method: "GET", handler: listVaults });
http.route({ path: "/api/v1/vaults", method: "OPTIONS", handler: listVaults });
http.route({ path: "/api/v1/vaults/get", method: "GET", handler: getVault });
http.route({ path: "/api/v1/vaults/get", method: "OPTIONS", handler: getVault });
http.route({ path: "/api/v1/vaults", method: "POST", handler: createVault });
http.route({ path: "/api/v1/vaults/rename", method: "PATCH", handler: renameVault });
http.route({ path: "/api/v1/vaults/rename", method: "OPTIONS", handler: renameVault });
http.route({ path: "/api/v1/vaults", method: "DELETE", handler: deleteVault });

// Folders
http.route({ path: "/api/v1/folders", method: "GET", handler: listFolders });
http.route({ path: "/api/v1/folders", method: "OPTIONS", handler: listFolders });
http.route({ path: "/api/v1/folders", method: "POST", handler: createFolder });
http.route({ path: "/api/v1/folders/rename", method: "PATCH", handler: renameFolder });
http.route({ path: "/api/v1/folders/rename", method: "OPTIONS", handler: renameFolder });
http.route({ path: "/api/v1/folders/move", method: "PATCH", handler: moveFolder });
http.route({ path: "/api/v1/folders/move", method: "OPTIONS", handler: moveFolder });
http.route({ path: "/api/v1/folders", method: "DELETE", handler: deleteFolder });

// Notes
http.route({ path: "/api/v1/notes", method: "GET", handler: listNotes });
http.route({ path: "/api/v1/notes", method: "OPTIONS", handler: listNotes });
http.route({ path: "/api/v1/notes/get", method: "GET", handler: getNote });
http.route({ path: "/api/v1/notes/get", method: "OPTIONS", handler: getNote });
http.route({ path: "/api/v1/notes/search", method: "GET", handler: searchNotes });
http.route({ path: "/api/v1/notes/search", method: "OPTIONS", handler: searchNotes });
http.route({ path: "/api/v1/notes/backlinks", method: "GET", handler: getBacklinks });
http.route({ path: "/api/v1/notes/backlinks", method: "OPTIONS", handler: getBacklinks });
http.route({ path: "/api/v1/notes/unlinked-mentions", method: "GET", handler: getUnlinkedMentions });
http.route({ path: "/api/v1/notes/unlinked-mentions", method: "OPTIONS", handler: getUnlinkedMentions });
http.route({ path: "/api/v1/notes", method: "POST", handler: createNote });
http.route({ path: "/api/v1/notes/update", method: "PATCH", handler: updateNote });
http.route({ path: "/api/v1/notes/update", method: "OPTIONS", handler: updateNote });
http.route({ path: "/api/v1/notes/rename", method: "PATCH", handler: renameNote });
http.route({ path: "/api/v1/notes/rename", method: "OPTIONS", handler: renameNote });
http.route({ path: "/api/v1/notes/move", method: "PATCH", handler: moveNote });
http.route({ path: "/api/v1/notes/move", method: "OPTIONS", handler: moveNote });
http.route({ path: "/api/v1/notes", method: "DELETE", handler: deleteNote });

export default http;
