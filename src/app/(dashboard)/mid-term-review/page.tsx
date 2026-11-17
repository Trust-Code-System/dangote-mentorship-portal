import { ReviewType } from '@prisma/client';
import { ReviewScreen } from '@/features/reviews/review-screen';

// Mid-term review fill/submit page (CLAUDE.md §5, M3). Thin wrapper over the
// shared, type-parameterized ReviewScreen.
export default async function MidTermReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mentee?: string }>;
}) {
  return <ReviewScreen type={ReviewType.MIDTERM} subjectMenteeId={(await searchParams).mentee} />;
}
