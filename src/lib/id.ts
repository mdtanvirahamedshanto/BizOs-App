/**
 * Stable unique id generation for offline-first records.
 *
 * These ids double as primary keys in SQLite, sync-outbox row ids, and
 * client-side idempotency keys, so collisions would cause silent data loss or
 * duplicate processing. We therefore generate RFC-4122 v4 UUIDs.
 *
 * Prefer a platform crypto RNG when one is available (Hermes/Web exposes
 * `crypto.getRandomValues`); otherwise fall back to a `Math.random`-seeded v4
 * which is still vastly more collision-resistant than `Math.random().toString()`.
 */

type CryptoLike = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
  randomUUID?: () => string;
};

const cryptoRef: CryptoLike | undefined =
  typeof globalThis !== 'undefined'
    ? (globalThis as unknown as { crypto?: CryptoLike }).crypto
    : undefined;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** Generates an RFC-4122 v4 UUID string. */
export function newId(): string {
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  const bytes = randomBytes(16);
  // Per RFC 4122 §4.4: set version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 256; i += 1) {
    hex.push((i + 0x100).toString(16).slice(1));
  }

  return (
    hex[bytes[0]] +
    hex[bytes[1]] +
    hex[bytes[2]] +
    hex[bytes[3]] +
    '-' +
    hex[bytes[4]] +
    hex[bytes[5]] +
    '-' +
    hex[bytes[6]] +
    hex[bytes[7]] +
    '-' +
    hex[bytes[8]] +
    hex[bytes[9]] +
    '-' +
    hex[bytes[10]] +
    hex[bytes[11]] +
    hex[bytes[12]] +
    hex[bytes[13]] +
    hex[bytes[14]] +
    hex[bytes[15]]
  );
}
