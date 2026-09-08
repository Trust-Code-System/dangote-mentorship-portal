'use client';

import { getSupabaseBrowser } from '@/lib/supabase/client';

export async function uploadFileToSignedTarget(input: {
  bucket: string;
  path: string;
  token: string;
  file: File;
}): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error('Secure upload service is unavailable.');
  const { error } = await supabase.storage
    .from(input.bucket)
    .uploadToSignedUrl(input.path, input.token, input.file, {
      contentType: input.file.type || 'application/octet-stream',
      cacheControl: '3600',
    });
  if (error) throw new Error('The upload was interrupted. Please try again.');
}
