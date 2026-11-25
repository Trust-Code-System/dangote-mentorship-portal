'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { approveMatch, overrideMatch, respondToMatch } from './actions';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

// Client wrappers for the approve/override actions. The bare server-action
// forms posted silently — no pending state, and a failed action (e.g. a match
// already approved, or a blocked cross-language override) produced no visible
// change, so the buttons looked broken. These mirror RunMatchingButton: pending
// label, success/error toast, and a refresh so the list reflects the new state.

export interface ApproveLabels {
  approve: string;
  approving: string;
  doneTitle: string;
  /** Uses {mentor} and {mentee} placeholders. */
  done: string;
  errorTitle: string;
}

export function ApproveMatchButton({
  matchId,
  mentorName,
  menteeName,
  labels,
}: {
  matchId: string;
  mentorName: string;
  menteeName: string;
  labels: ApproveLabels;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function approve() {
    const fd = new FormData();
    fd.set('matchId', matchId);
    startTransition(async () => {
      const res = await approveMatch(fd);
      if (res.ok) {
        toast({
          title: labels.doneTitle,
          description: labels.done.replace('{mentor}', mentorName).replace('{mentee}', menteeName),
        });
        router.refresh();
      } else {
        toast({ title: labels.errorTitle, description: res.error.message, variant: 'destructive' });
      }
    });
  }

  return (
    <Button type="button" size="sm" onClick={approve} disabled={pending}>
      {pending ? labels.approving : labels.approve}
    </Button>
  );
}

export interface OverrideLabels {
  mentor: string;
  overrideSubmit: string;
  assigning: string;
  doneTitle: string;
  /** Uses {mentor} and {mentee} placeholders. */
  done: string;
  errorTitle: string;
}

export interface MentorOption {
  userId: string;
  fullName: string;
  preferredLanguage: string;
}

export function OverrideMatchForm({
  cohortId,
  menteeId,
  menteeName,
  mentorOptions,
  labels,
}: {
  cohortId: string;
  menteeId: string;
  menteeName: string;
  mentorOptions: MentorOption[];
  labels: OverrideLabels;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [mentorId, setMentorId] = React.useState(mentorOptions[0]?.userId ?? '');

  function submit() {
    if (!mentorId) return;
    const fd = new FormData();
    fd.set('cohortId', cohortId);
    fd.set('menteeId', menteeId);
    fd.set('mentorId', mentorId);
    startTransition(async () => {
      const res = await overrideMatch(fd);
      if (res.ok) {
        const mentorName = mentorOptions.find((m) => m.userId === mentorId)?.fullName ?? '';
        toast({
          title: labels.doneTitle,
          description: labels.done.replace('{mentor}', mentorName).replace('{mentee}', menteeName),
        });
        router.refresh();
      } else {
        toast({ title: labels.errorTitle, description: res.error.message, variant: 'destructive' });
      }
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <Select value={mentorId} onValueChange={setMentorId}>
        <SelectTrigger
          aria-label={labels.mentor}
          className="w-full min-w-0 sm:w-auto sm:min-w-[16rem]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mentorOptions.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.fullName} ({m.preferredLanguage})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" onClick={submit} disabled={pending || !mentorId}>
        {pending ? labels.assigning : labels.overrideSubmit}
      </Button>
    </div>
  );
}

export interface RespondLabels {
  accept: string;
  accepting: string;
  decline: string;
  declining: string;
  acceptedTitle: string;
  /** Uses {name} placeholder. */
  acceptedDone: string;
  declinedTitle: string;
  /** Uses {name} placeholder. */
  declinedDone: string;
  errorTitle: string;
}

export function RespondMatchButtons({
  matchId,
  otherName,
  labels,
}: {
  matchId: string;
  otherName: string;
  labels: RespondLabels;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<'accept' | 'reject' | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function respond(decision: 'accept' | 'reject') {
    const fd = new FormData();
    fd.set('matchId', matchId);
    fd.set('decision', decision);
    setPending(decision);
    startTransition(async () => {
      const res = await respondToMatch(fd);
      if (res.ok) {
        toast({
          title: decision === 'accept' ? labels.acceptedTitle : labels.declinedTitle,
          description: (decision === 'accept' ? labels.acceptedDone : labels.declinedDone).replace(
            '{name}',
            otherName,
          ),
        });
        router.refresh();
      } else {
        toast({ title: labels.errorTitle, description: res.error.message, variant: 'destructive' });
      }
      setPending(null);
    });
  }

  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" onClick={() => respond('accept')} disabled={isPending}>
        {isPending && pending === 'accept' ? labels.accepting : labels.accept}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => respond('reject')}
        disabled={isPending}
      >
        {isPending && pending === 'reject' ? labels.declining : labels.decline}
      </Button>
    </div>
  );
}
