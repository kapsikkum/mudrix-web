/**
 * Generates a consistent 10-character uppercase device ID following Matrix conventions.
 */
export function generateDeviceId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => alphabet[b % 26]).join('');
}
