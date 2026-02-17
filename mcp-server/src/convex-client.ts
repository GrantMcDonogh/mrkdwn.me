import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error("CONVEX_URL environment variable is required");
}

export const client = new ConvexHttpClient(convexUrl);

// Set auth token if provided
const authToken = process.env.CONVEX_AUTH_TOKEN;
if (authToken) {
  client.setAuth(authToken);
}
