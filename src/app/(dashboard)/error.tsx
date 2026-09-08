'use client';

import { SegmentError } from '@/components/shell/segment-error';

// Segment boundary inside AppShell — page failures keep the sidebar/top bar.
export default function DashboardSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError error={error} reset={reset} />;
}
