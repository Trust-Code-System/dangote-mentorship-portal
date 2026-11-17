import {
  constants,
  createCipheriv,
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { getSupabaseAdmin } from '../src/lib/supabase/server';

// Explicit operator-only export during a staged production build. The private
// recovery key stays on the owner's computer. Existing participant files are
// read only; the encrypted archive is written under a separate private prefix.
export async function exportStorageBackup(): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') throw new Error('Production export required.');
  const id = process.env.RECOVERY_EXPORT_ID ?? '';
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Recovery export ID is required.');
  const pem = Buffer.from(process.env.RECOVERY_PUBLIC_KEY_B64 ?? '', 'base64');
  const publicKey = createPublicKey(pem);
  if (
    publicKey.asymmetricKeyType !== 'rsa' ||
    (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 3072
  )
    throw new Error('A strong public recovery key is required.');
  const keyHash = createHash('sha256').update(pem).digest('hex');
  const client = getSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!;
  if (
    !client ||
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname !==
      'owkgqglwvjlaizsfpuir.supabase.co' ||
    bucket !== 'portal-files'
  )
    throw new Error('Unexpected Storage target.');
  const storage = client.storage.from(bucket);
  const destination = `recovery-exports/${id}.json`;
  const prior = await storage.download(destination);
  if (prior.data && !prior.error) {
    const saved = JSON.parse(await prior.data.text());
    if (saved.id !== id || saved.publicKeySha256 !== keyHash)
      throw new Error('Existing export differs.');
    console.info('[recovery] Matching encrypted Storage export already exists; not duplicated.');
    return;
  }
  const { data: bucketData, error: bucketError } = await client.storage.getBucket(bucket);
  if (bucketError || !bucketData || bucketData.public)
    throw new Error('Storage must remain private.');
  type Entry = { path: string; size: number; updatedAt: string; contentType: string };
  async function inventory(prefix = '', depth = 0): Promise<Entry[]> {
    if (depth > 16) throw new Error('Storage nesting limit exceeded.');
    const files: Entry[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error || !data) throw new Error('Storage inventory failed.');
      for (const entry of data) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (path === 'recovery-exports' || path === 'release-check') continue;
        if (!entry.id) files.push(...(await inventory(path, depth + 1)));
        else
          files.push({
            path,
            size: Number(entry.metadata?.size ?? 0),
            updatedAt: entry.updated_at ?? '',
            contentType: entry.metadata?.mimetype ?? 'application/octet-stream',
          });
        if (files.length > 5000) throw new Error('Storage object limit exceeded.');
      }
      if (data.length < 1000) break;
    }
    return files;
  }
  const before = await inventory();
  if (before.reduce((sum, item) => sum + item.size, 0) > 32 * 1024 * 1024)
    throw new Error('Storage export needs the large-object backup workflow.');
  const objects = [];
  let total = 0;
  for (const item of before) {
    const { data, error } = await storage.download(item.path);
    if (error || !data) throw new Error('Storage backup download failed.');
    const bytes = Buffer.from(await data.arrayBuffer());
    total += bytes.length;
    if (bytes.length !== item.size || total > 32 * 1024 * 1024)
      throw new Error('Storage object changed or export is too large.');
    objects.push({
      ...item,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      data: bytes.toString('base64'),
    });
  }
  if (JSON.stringify(before) !== JSON.stringify(await inventory()))
    throw new Error('Storage changed during the export; retry with a fresh export ID.');
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(id));
  const payload = gzipSync(
    Buffer.from(
      JSON.stringify({
        version: 1,
        id,
        source: 'owkgqglwvjlaizsfpuir/portal-files',
        createdAt: new Date().toISOString(),
        objects,
      }),
    ),
  );
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope = Buffer.from(
    JSON.stringify({
      version: 1,
      id,
      publicKeySha256: keyHash,
      algorithm: 'RSA-OAEP-SHA256+AES-256-GCM',
      encryptedKey: publicEncrypt(
        { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        key,
      ).toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: encrypted.toString('base64'),
    }),
  );
  if (envelope.length > 45 * 1024 * 1024)
    throw new Error('Encrypted export exceeds the safe upload limit.');
  const { error } = await storage.upload(destination, envelope, {
    contentType: 'application/json',
    upsert: false,
  });
  if (error) throw new Error('Encrypted Storage export upload failed.');
  const verified = await storage.download(destination);
  if (
    !verified.data ||
    verified.error ||
    !Buffer.from(await verified.data.arrayBuffer()).equals(envelope)
  )
    throw new Error('Encrypted Storage archive verification failed.');
  console.info(
    `[recovery] Encrypted Storage export verified: ${objects.length} objects, ${total} source bytes; source files unchanged.`,
  );
}
