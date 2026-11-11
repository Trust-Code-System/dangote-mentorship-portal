'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isGoalSetupPath } from './setup-path';

// Shared layouts persist on soft navigation. Keep the mandatory screen enforced
// there too, while the server layout handles reloads and direct URLs.
export function GoalSetupBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = isGoalSetupPath(pathname);
  useEffect(() => {
    if (!allowed) router.replace('/goals');
  }, [allowed, router]);
  return allowed ? children : null;
}
