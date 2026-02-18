import { httpAction } from "./_generated/server";

export const onboarding = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "origin",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const { answers } = await request.json();
  if (!answers || typeof answers !== "object") {
    return new Response("Missing answers", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const systemPrompt = `You are an expert knowledge management consultant who helps people build their "second brain" using a note-taking app similar to Obsidian.

Given the user's preferences, generate a personalized vault structure as a JSON object. The vault should follow best practices for knowledge management (Zettelkasten, PARA method, etc.) adapted to the user's needs.

IMPORTANT RULES:
- Output ONLY valid JSON, no markdown fencing, no explanation
- Use [[Wiki Link]] syntax in note content to link between notes
- Every note's folderTempId must reference a valid folder tempId
- Notes at the root level should have no folderTempId
- Folder parentTempId references another folder's tempId for nesting
- Root-level folders should have no parentTempId
- Generate 3-8 folders and 5-15 notes depending on the starter content preference
- Note content should be helpful markdown with headings, bullet points, and wiki links to other notes in the vault
- For "Empty structure only", create folders but only 1-2 index notes
- For "Full starter kit", create more notes with richer content

The JSON must match this exact shape:
{
  "vaultName": "string",
  "folders": [
    { "tempId": "folder-0", "name": "string", "parentTempId": "folder-N or omit for root", "order": 0 }
  ],
  "notes": [
    { "title": "string", "content": "markdown string with [[Wiki Links]]", "folderTempId": "folder-N or omit for root", "order": 0 }
  ]
}`;

  const topics = Array.isArray(answers.topics)
    ? answers.topics.join(", ")
    : (answers.topics ?? "Mixed");

  const userMessage = `Create a vault for someone with these preferences:
- Primary use: ${answers.purpose ?? "General second brain"}
- Topics of interest: ${topics}
- Organization style: ${answers.organization ?? "By topic"}
- Starter content: ${answers.starter ?? "Templates & examples"}`;

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      stream: false,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!claudeResponse.ok) {
    const errorText = await claudeResponse.text();
    return new Response(`Claude API error: ${errorText}`, {
      status: 502,
      headers: corsHeaders,
    });
  }

  const claudeData = await claudeResponse.json();
  let text =
    claudeData.content?.[0]?.type === "text"
      ? claudeData.content[0].text
      : "";

  // Strip markdown fencing if present
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

  try {
    const parsed = JSON.parse(text);

    // Validate structure
    if (
      !parsed.vaultName ||
      !Array.isArray(parsed.folders) ||
      !Array.isArray(parsed.notes)
    ) {
      return new Response("Invalid vault structure from AI", {
        status: 502,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Failed to parse AI response as JSON", {
      status: 502,
      headers: corsHeaders,
    });
  }
});
