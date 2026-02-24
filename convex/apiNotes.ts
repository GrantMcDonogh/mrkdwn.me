import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { apiKeyAction, jsonOk, jsonError, requireQueryParam, parseBody } from "./apiHelpers";

export const listNotes = apiKeyAction(async (ctx, request, auth) => {
  const data = await ctx.runQuery(internal.internalApi.listNotes, { vaultId: auth.vaultId });
  return jsonOk(request, data);
});

export const getNote = apiKeyAction(async (ctx, request, auth) => {
  const param = requireQueryParam(request, "id");
  if (param.errorResponse) return param.errorResponse;
  const data = await ctx.runQuery(internal.internalApi.getNote, {
    id: param.value as Id<"notes">,
    vaultId: auth.vaultId,
  });
  return jsonOk(request, data);
});

export const searchNotes = apiKeyAction(async (ctx, request, auth) => {
  const queryParam = requireQueryParam(request, "query");
  if (queryParam.errorResponse) return queryParam.errorResponse;
  const data = await ctx.runQuery(internal.internalApi.searchNotes, {
    vaultId: auth.vaultId,
    query: queryParam.value,
  });
  return jsonOk(request, data);
});

export const getBacklinks = apiKeyAction(async (ctx, request, auth) => {
  const param = requireQueryParam(request, "noteId");
  if (param.errorResponse) return param.errorResponse;
  const data = await ctx.runQuery(internal.internalApi.getBacklinks, {
    noteId: param.value as Id<"notes">,
    vaultId: auth.vaultId,
  });
  return jsonOk(request, data);
});

export const getUnlinkedMentions = apiKeyAction(async (ctx, request, auth) => {
  const param = requireQueryParam(request, "noteId");
  if (param.errorResponse) return param.errorResponse;
  const data = await ctx.runQuery(internal.internalApi.getUnlinkedMentions, {
    noteId: param.value as Id<"notes">,
    vaultId: auth.vaultId,
  });
  return jsonOk(request, data);
});

export const createNote = apiKeyAction(async (ctx, request, auth) => {
  const parsed = await parseBody<{ title: string; folderId?: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { title, folderId } = parsed.body;
  if (!title) return jsonError(request, "Missing required field: title", 400);
  const id = await ctx.runMutation(internal.internalApi.createNote, {
    title,
    vaultId: auth.vaultId,
    folderId: folderId ? (folderId as Id<"folders">) : undefined,
  });
  return jsonOk(request, { id }, 201);
});

export const updateNote = apiKeyAction(async (ctx, request, auth) => {
  const parsed = await parseBody<{ id: string; content: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, content } = parsed.body;
  if (!id || content === undefined) return jsonError(request, "Missing required fields: id, content", 400);
  await ctx.runMutation(internal.internalApi.updateNote, {
    id: id as Id<"notes">,
    vaultId: auth.vaultId,
    content,
  });
  return jsonOk(request, null);
});

export const renameNote = apiKeyAction(async (ctx, request, auth) => {
  const parsed = await parseBody<{ id: string; title: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, title } = parsed.body;
  if (!id || !title) return jsonError(request, "Missing required fields: id, title", 400);
  await ctx.runMutation(internal.internalApi.renameNote, {
    id: id as Id<"notes">,
    vaultId: auth.vaultId,
    title,
  });
  return jsonOk(request, null);
});

export const moveNote = apiKeyAction(async (ctx, request, auth) => {
  const parsed = await parseBody<{ id: string; folderId?: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, folderId } = parsed.body;
  if (!id) return jsonError(request, "Missing required field: id", 400);
  await ctx.runMutation(internal.internalApi.moveNote, {
    id: id as Id<"notes">,
    vaultId: auth.vaultId,
    folderId: folderId ? (folderId as Id<"folders">) : undefined,
  });
  return jsonOk(request, null);
});

export const deleteNote = apiKeyAction(async (ctx, request, auth) => {
  const param = requireQueryParam(request, "id");
  if (param.errorResponse) return param.errorResponse;
  await ctx.runMutation(internal.internalApi.removeNote, {
    id: param.value as Id<"notes">,
    vaultId: auth.vaultId,
  });
  return jsonOk(request, null);
});
