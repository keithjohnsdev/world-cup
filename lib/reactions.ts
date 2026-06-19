// The fixed emoji palette for message-board reactions. Shared by the API (to
// validate incoming reactions) and the UI (to render the picker), so the two can
// never drift. Keep this list short — it's a family chatter board, not Slack.
export const REACTIONS = ["❤️", "😂", "🔥", "👍", "😮"] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: unknown): value is Reaction {
  return typeof value === "string" && (REACTIONS as readonly string[]).includes(value);
}
