import { httpRouter } from "convex/server";
import { chat } from "./chat";
import { chatEdit } from "./chatEdit";
import { onboarding } from "./onboarding";
import { testKey } from "./testKey";

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

export default http;
