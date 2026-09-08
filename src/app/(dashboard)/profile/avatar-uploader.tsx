'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  removeOwnAvatar,
  prepareOwnAvatarUpload,
  confirmOwnAvatarUpload,
  uploadOwnAvatar,
  type ProfileActionState,
} from '@/features/profiles/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadFileToSignedTarget } from '@/lib/storage/browser-upload';

export function AvatarUploader({
  imageUrl,
  initials,
}: {
  imageUrl: string | null;
  initials: string;
}) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const fileId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);

  const [uploadState, setUploadState] = useState<ProfileActionState>(null);
  const [uploading, setUploading] = useState(false);
  const [removeState, remove, removing] = useActionState<ProfileActionState, FormData>(
    removeOwnAvatar,
    null,
  );

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return;
    setUploading(true);
    setUploadState(null);
    try {
      const prepared = await prepareOwnAvatarUpload({ name: file.name, type: file.type, size: file.size });
      if (!prepared.ok) return setUploadState(prepared);
      if (prepared.data.mode === 'server') {
        setUploadState(await uploadOwnAvatar(null, formData));
      } else {
        await uploadFileToSignedTarget({ ...prepared.data, file });
        setUploadState(
          await confirmOwnAvatarUpload({
            path: prepared.data.path,
            type: file.type,
            size: file.size,
          }),
        );
      }
    } catch (error) {
      setUploadState({
        ok: false,
        error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Upload failed.' },
      });
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!uploadState?.ok && !removeState?.ok) return;
    formRef.current?.reset();
    router.refresh();
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPreview(null);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadState, removeState]);

  const shown = preview ?? imageUrl;
  const error =
    (uploadState && !uploadState.ok && uploadState.error.message) ||
    (removeState && !removeState.ok && removeState.error.message) ||
    null;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="size-16 ring-2 ring-border">
        {shown ? <AvatarImage src={shown} alt="" /> : null}
        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
      </Avatar>

      <div className="space-y-2">
        <form ref={formRef} onSubmit={(event) => void submitUpload(event)} className="flex flex-wrap items-center gap-2">
          <Input
            id={fileId}
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="max-w-xs"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          <Button type="submit" size="sm" disabled={uploading}>
            {uploading ? tc('loading') : t('uploadPhoto')}
          </Button>
        </form>

        {imageUrl ? (
          <form action={remove}>
            <Button type="submit" size="sm" variant="ghost" disabled={removing}>
              {removing ? tc('loading') : t('removePhoto')}
            </Button>
          </form>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('photoHint')}</p>
        )}
      </div>
    </div>
  );
}
