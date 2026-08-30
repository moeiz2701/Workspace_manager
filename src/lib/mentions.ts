/**
 * @mentions are stored inline in the comment body as `@[Display Name](uuid)`.
 *
 * The uuid is what `comment_mentions` is keyed on, so the notification trigger
 * fires for the right person even if they later change their display name; the
 * name is kept so an old comment still reads correctly.
 */

const MENTION = /@\[([^\]]+)]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export type MentionToken =
  { type: 'text'; value: string } | { type: 'mention'; name: string; profileId: string };

export function extractMentionIds(body: string): string[] {
  const ids = new Set<string>();
  for (const match of body.matchAll(MENTION)) ids.add(match[2]!.toLowerCase());
  return [...ids];
}

/** Split a body into plain text and mention tokens for rendering. */
export function tokenizeMentions(body: string): MentionToken[] {
  const tokens: MentionToken[] = [];
  let cursor = 0;

  for (const match of body.matchAll(MENTION)) {
    const start = match.index;
    if (start > cursor) tokens.push({ type: 'text', value: body.slice(cursor, start) });
    tokens.push({ type: 'mention', name: match[1]!, profileId: match[2]! });
    cursor = start + match[0].length;
  }

  if (cursor < body.length) tokens.push({ type: 'text', value: body.slice(cursor) });
  return tokens;
}

export function formatMention(name: string, profileId: string): string {
  // A `]` inside the display name would break the token.
  return `@[${name.replace(/]/g, '')}](${profileId})`;
}

/** Body as a person reads it, for notification previews and search. */
export function plainTextBody(body: string): string {
  return body.replace(MENTION, (_, name: string) => `@${name}`);
}
