import { httpRouter } from "convex/server";
import { chat } from "./chat";

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

export default http;
