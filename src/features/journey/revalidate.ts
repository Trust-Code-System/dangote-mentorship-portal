import { revalidatePath } from 'next/cache';

/** Keep saved milestones consistent across the dashboards and pair workspace. */
export function revalidateMentorshipProgress(): void {
  revalidatePath('/dashboard/mentee');
  revalidatePath('/dashboard/mentor');
  revalidatePath('/pair');
  revalidatePath('/pair/[menteeId]', 'page');
  revalidatePath('/certificate');
}
