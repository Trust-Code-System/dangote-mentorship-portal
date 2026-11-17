import { constants, createDecipheriv, createHash, privateDecrypt } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, dirname, sep } from 'node:path';

// Verifies a downloaded encrypted Storage export. Restores only into a fresh
// owner-private local directory, verifies all bytes, then removes that test copy.
const [archiveArg, directoryArg] = process.argv.slice(2);
if (!archiveArg || !directoryArg)
  throw new Error('Provide encrypted archive and private backup directory.');
const directory = resolve(directoryArg);
const allowed = resolve(homedir(), '.codex', 'private', 'mentorship-backups') + sep;
if (!directory.startsWith(allowed)) throw new Error('Expected the owner-private backup directory.');
const envelope = JSON.parse(await readFile(resolve(archiveArg), 'utf8'));
if (
  envelope.version !== 1 ||
  envelope.algorithm !== 'RSA-OAEP-SHA256+AES-256-GCM' ||
  !/^[a-f0-9-]{36}$/.test(envelope.id)
)
  throw new Error('Unexpected archive format.');
const publicKey = await readFile(join(directory, 'storage-recovery-public.pem'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (envelope.publicKeySha256 !== sha256(publicKey)) throw new Error('Recovery key does not match.');
const key = privateDecrypt(
  {
    key: await readFile(join(directory, 'storage-recovery-private.pem')),
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  },
  Buffer.from(envelope.encryptedKey, 'base64'),
);
const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
decipher.setAAD(Buffer.from(envelope.id));
decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
const compressed = Buffer.concat([
  decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
  decipher.final(),
]);
const payload = JSON.parse(
  gunzipSync(compressed, { maxOutputLength: 64 * 1024 * 1024 }).toString('utf8'),
);
if (
  payload.id !== envelope.id ||
  payload.source !== 'owkgqglwvjlaizsfpuir/portal-files' ||
  !Array.isArray(payload.objects) ||
  payload.objects.length > 5000
)
  throw new Error('Unexpected backup scope.');
const destination = resolve(directory, `storage-restore-${envelope.id}`);
if (!destination.startsWith(directory + sep) || !destination.startsWith(allowed))
  throw new Error('Unsafe restore directory.');
let created = false;
try {
  await mkdir(destination);
  created = true;
  let total = 0;
  const seen = new Set();
  const manifest = [];
  for (const object of payload.objects) {
    if (
      typeof object.path !== 'string' ||
      object.path.includes('\\') ||
      object.path.split('/').some((part) => !part || part === '.' || part === '..') ||
      seen.has(object.path)
    )
      throw new Error('Unsafe or duplicate object path.');
    seen.add(object.path);
    const output = resolve(destination, ...object.path.split('/'));
    if (!output.startsWith(destination + sep))
      throw new Error('Object escapes isolated restore directory.');
    const bytes = Buffer.from(object.data, 'base64');
    total += bytes.length;
    if (total > 32 * 1024 * 1024 || bytes.length !== object.size || sha256(bytes) !== object.sha256)
      throw new Error('Backup object integrity mismatch.');
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, bytes, { flag: 'wx', mode: 0o600 });
    if (sha256(await readFile(output)) !== object.sha256)
      throw new Error('Restored object integrity mismatch.');
    manifest.push({ path: object.path, bytes: bytes.length, sha256: object.sha256 });
  }
  const saved = join(directory, `storage-export-${envelope.id}.json`);
  if (resolve(archiveArg) !== saved)
    await copyFile(resolve(archiveArg), saved, fsConstants.COPYFILE_EXCL);
  await writeFile(
    join(directory, 'storage-verification.json'),
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        source: payload.source,
        exportedAt: payload.createdAt,
        archiveSha256: sha256(await readFile(saved)),
        objects: manifest,
        restoredObjects: manifest.length,
        sourceBytes: total,
        encrypted: true,
        originalObjectsUnchanged: true,
      },
      null,
      2,
    ),
    { flag: 'wx', mode: 0o600 },
  );
  console.info(
    JSON.stringify({
      verified: true,
      restoredObjects: manifest.length,
      bytes: total,
      backupDirectory: directory,
    }),
  );
} finally {
  // Only this run's fresh isolated destination, resolved within the verified
  // owner-private backup directory above. Never remove original files or archives.
  if (created) await rm(destination, { recursive: true });
}
