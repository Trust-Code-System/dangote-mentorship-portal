import 'server-only';

// Defence-in-depth for untrusted uploads (production-readiness-report.md M1 /
// m2-audit-findings #3). The browser-supplied `file.type` is attacker-controlled,
// so we never trust it alone: after the MIME allowlist passes we also confirm the
// bytes actually start with that format's signature ("magic number"). This stops
// a file with forged `Content-Type: image/png` but, say, HTML/script payload
// bytes from ever reaching storage.
//
// Formats without a reliable leading signature (plain text) are inert when served
// with `nosniff` + `attachment`, so they're accepted without a byte check.

type Signature = number[];

// Each allowed MIME maps to the byte signatures that may legitimately start it.
// OOXML files (docx/pptx) are ZIP containers, so they share the PK signatures.
const ZIP_SIGNATURES: Signature[] = [
  [0x50, 0x4b, 0x03, 0x04], // normal archive
  [0x50, 0x4b, 0x05, 0x06], // empty archive
  [0x50, 0x4b, 0x07, 0x08], // spanned archive
];

const SIGNATURES: Record<string, Signature[] | 'skip'> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ZIP_SIGNATURES,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ZIP_SIGNATURES,
  // No deterministic magic number; inert when served as a download.
  'text/plain': 'skip',
};

function startsWith(bytes: Uint8Array, signature: Signature): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

/**
 * True when `bytes` actually begin with a signature valid for `declaredMime`.
 * Returns false for any MIME not in the allowlist (caller should have already
 * rejected those) and for content whose bytes don't match the claimed type.
 */
export function verifyFileSignature(bytes: Uint8Array, declaredMime: string): boolean {
  if (declaredMime === 'image/webp') {
    return (
      bytes.length >= 12 &&
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  const expected = SIGNATURES[declaredMime];
  if (!expected) return false;
  if (expected === 'skip') return true;
  return expected.some((sig) => startsWith(bytes, sig));
}
