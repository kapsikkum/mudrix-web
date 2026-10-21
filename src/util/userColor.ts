// Element's username palette: each user id hashes to one of eight fixed colours, so a person keeps
// the same colour in every room and client. A profile accent colour, when set, overrides it.
const USERNAME_COLORS = [
  '#368bd6',
  '#ac3ba8',
  '#03b381',
  '#e64f7a',
  '#ff812d',
  '#2dc2c5',
  '#5c56f5',
  '#74d12c',
] as const;

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function userNameColor(userId: string, profileAccent?: string | null): string {
  return profileAccent || USERNAME_COLORS[hashCode(userId) % USERNAME_COLORS.length];
}
