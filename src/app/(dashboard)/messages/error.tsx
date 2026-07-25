'use client';

import { SegmentError } from '@/components/shell/segment-error';

export default function MessagesSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError error={error} reset={reset} />;
}
