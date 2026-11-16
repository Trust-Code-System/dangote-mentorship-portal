import { ReviewType } from '@prisma/client';
import { ReviewScreen } from '@/features/reviews/review-screen';

// Final review fill/submit page (CLAUDE.md §5, M3). Thin wrapper over the
// shared, type-parameterized ReviewScreen.
export default async function FinalReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mentee?: string }>;
}) {
  return <ReviewScreen type={ReviewType.FINAL} subjectMenteeId={(await searchParams).mentee} />;
}
