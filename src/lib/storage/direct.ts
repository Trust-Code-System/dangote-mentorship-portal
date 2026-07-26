import 'server-only';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

export interface SignedUploadTarget {
  bucket: string;
  path: string;
  token: string;
}

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET ?? 'portal-files';
}

export function canUseDirectUploads(): boolean {
  return Boolean(
    isSupabaseConfigured() &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function assertSafeStorageKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error('Invalid storage key.');
}

export async function createSignedUploadTarget(path: string): Promise<SignedUploadTarget> {
  assertSafeStorageKey(path);
  const supabase = getSupabaseAdmin();
  if (!supabase || !canUseDirectUploads()) {
    throw new Error('Direct uploads are not configured.');
  }
  const bucket = storageBucket();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data) throw new Error('Unable to prepare a secure upload.');
  return { bucket, path: data.path, token: data.token };
}

export async function removeStoredObject(path: string): Promise<void> {
  assertSafeStorageKey(path);
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.storage.from(storageBucket()).remove([path]);
}
