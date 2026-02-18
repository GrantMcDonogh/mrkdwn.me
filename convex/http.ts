import { httpRouter } from "convex/server";
import { chat } from "./chat";
import { onboarding } from "./onboarding";

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

export default http;
