import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { apiAction, jsonOk, jsonError, requireAuth, requireQueryParam, parseBody } from "./apiHelpers";

export const listNotes = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const param = requireQueryParam(request, "vaultId");
  if (param.errorResponse) return param.errorResponse;
  const data = await ctx.runQuery(api.notes.list, { vaultId: param.value as Id<"vaults"> });
  return jsonOk(request, data);
});

export const getNote = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const param = requireQueryParam(request, "id");
  if (param.errorResponse) return param.errorResponse;
  const data = await ctx.runQuery(api.notes.get, { id: param.value as Id<"notes"> });
  return jsonOk(request, data);
});

export const searchNotes = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const vaultParam = requireQueryParam(request, "vaultId");
  if (vaultParam.errorResponse) return vaultParam.errorResponse;
  const queryParam = requireQueryParam(request, "query");
  if (queryParam.errorResponse) return queryParam.errorResponse;
  const data = await ctx.runQuery(api.notes.search, {
    vaultId: vaultParam.value as Id<"vaults">,
    query: queryParam.value,
  });
  return jsonOk(request, data);
});

export const getBacklinks = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const param = requireQueryParam(request, "noteId");
  if (param.errorResponse) return param.errorResponse;
  const data = await ctx.runQuery(api.notes.getBacklinks, { noteId: param.value as Id<"notes"> });
  return jsonOk(request, data);
});

export const getUnlinkedMentions = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const param = requireQueryParam(request, "noteId");
  if (param.errorResponse) return param.errorResponse;
  const data = await ctx.runQuery(api.notes.getUnlinkedMentions, { noteId: param.value as Id<"notes"> });
  return jsonOk(request, data);
});

export const createNote = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = await parseBody<{ title: string; vaultId: string; folderId?: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { title, vaultId, folderId } = parsed.body;
  if (!title || !vaultId) return jsonError(request, "Missing required fields: title, vaultId", 400);
  const id = await ctx.runMutation(api.notes.create, {
    title,
    vaultId: vaultId as Id<"vaults">,
    folderId: folderId ? (folderId as Id<"folders">) : undefined,
  });
  return jsonOk(request, { id }, 201);
});

export const updateNote = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = await parseBody<{ id: string; content: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, content } = parsed.body;
  if (!id || content === undefined) return jsonError(request, "Missing required fields: id, content", 400);
  await ctx.runMutation(api.notes.update, { id: id as Id<"notes">, content });
  return jsonOk(request, null);
});

export const renameNote = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = await parseBody<{ id: string; title: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, title } = parsed.body;
  if (!id || !title) return jsonError(request, "Missing required fields: id, title", 400);
  await ctx.runMutation(api.notes.rename, { id: id as Id<"notes">, title });
  return jsonOk(request, null);
});

export const moveNote = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const parsed = await parseBody<{ id: string; folderId?: string }>(request);
  if (parsed.errorResponse) return parsed.errorResponse;
  const { id, folderId } = parsed.body;
  if (!id) return jsonError(request, "Missing required field: id", 400);
  await ctx.runMutation(api.notes.move, {
    id: id as Id<"notes">,
    folderId: folderId ? (folderId as Id<"folders">) : undefined,
  });
  return jsonOk(request, null);
});

export const deleteNote = apiAction(async (ctx, request) => {
  const auth = await requireAuth(ctx, request);
  if (auth.errorResponse) return auth.errorResponse;
  const param = requireQueryParam(request, "id");
  if (param.errorResponse) return param.errorResponse;
  await ctx.runMutation(api.notes.remove, { id: param.value as Id<"notes"> });
  return jsonOk(request, null);
});
