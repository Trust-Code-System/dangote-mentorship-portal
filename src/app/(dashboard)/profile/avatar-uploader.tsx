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
  const uploadFormId = useId();
  const hintId = useId();
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
      const prepared = await prepareOwnAvatarUpload({
        name: file.name,
        type: file.type,
        size: file.size,
      });
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
        error: {
          code: 'UNKNOWN',
          message: error instanceof Error ? error.message : 'Upload failed.',
        },
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
    <div className="@container">
      <div className="flex flex-col items-start gap-4 @sm:flex-row">
        <Avatar className="ring-border size-16 shrink-0 ring-2">
          {shown ? <AvatarImage src={shown} alt="" /> : null}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>

        <div className="w-full min-w-0 flex-1 space-y-2">
          <div className="flex flex-col gap-2 @2xl:flex-row @2xl:items-center">
            <form
              id={uploadFormId}
              ref={formRef}
              onSubmit={(event) => void submitUpload(event)}
              className="w-full min-w-0 @2xl:flex-1"
            >
              <Input
                id={fileId}
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label={t('uploadPhoto')}
                aria-describedby={hintId}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </form>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button form={uploadFormId} type="submit" disabled={uploading}>
                {uploading ? tc('loading') : t('uploadPhoto')}
              </Button>

              {imageUrl ? (
                <form action={remove}>
                  <Button type="submit" variant="outline" disabled={removing}>
                    {removing ? tc('loading') : t('removePhoto')}
                  </Button>
                </form>
              ) : null}
            </div>
          </div>

          {error ? (
            <p id={hintId} role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : (
            <p id={hintId} className="text-muted-foreground text-xs">
              {t('photoHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
