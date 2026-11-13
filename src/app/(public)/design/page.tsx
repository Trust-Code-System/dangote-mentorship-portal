'use client';

import * as React from 'react';
import { Bell, Plus, Inbox, Sparkles, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarGroup } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { ProgressRing } from '@/components/ui/progress-ring';
import { StatTile } from '@/components/ui/stat-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Fab } from '@/components/ui/fab';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/components/ui/use-toast';
import { JourneyRailView, type RailNode } from '@/components/journey-rail-view';
import { BilingualField, BilingualContent } from '@/components/bilingual-field';
import { AIContainer } from '@/components/ai-container';

// Component-preview gallery for the Design System (§19, step 2). Demonstrates the
// token layer + themed §4 primitives in one place for review. Not a feature
// screen — no real data, no app navigation. The signature components (Journey
// Rail §5, bilingual field §6, AI container §7) and feature screens come after
// sign-off.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-8">
      <h2 className="text-h2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

const SWATCHES: { name: string; className: string; text?: string }[] = [
  { name: 'green', className: 'bg-green' },
  { name: 'green-strong', className: 'bg-green-strong' },
  { name: 'green-soft', className: 'bg-green-soft', text: 'text-green-strong' },
  { name: 'gold', className: 'bg-gold' },
  { name: 'ok', className: 'bg-ok' },
  { name: 'warn', className: 'bg-warn' },
  { name: 'risk', className: 'bg-risk' },
  { name: 'info', className: 'bg-info' },
  { name: 'ink', className: 'bg-ink' },
  { name: 'ink-2', className: 'bg-ink-2' },
  { name: 'ink-3', className: 'bg-ink-3' },
  { name: 'surface', className: 'bg-surface border border-border', text: 'text-ink' },
  { name: 'surface-2', className: 'bg-surface-2', text: 'text-ink' },
  { name: 'border', className: 'bg-border', text: 'text-ink' },
];

const RAIL_NODES: RailNode[] = [
  { key: 'profile', label: 'Profile', stateLabel: 'Done', state: 'completed', link: '/profile', isCurrent: false },
  { key: 'training', label: 'Training', stateLabel: 'Done', state: 'completed', link: null, isCurrent: false },
  { key: 'matched', label: 'Matched', stateLabel: 'Done', state: 'completed', link: null, isCurrent: false },
  { key: 'confidentiality', label: 'Confidentiality agreement', stateLabel: 'Done', state: 'completed', link: '/agreements', isCurrent: false },
  { key: 'goals', label: 'Goals submitted', stateLabel: 'Your turn', state: 'needs_action', link: '/goals', isCurrent: true },
  { key: 'sessions', label: 'Monthly sessions', stateLabel: 'Overdue', state: 'overdue', link: '/sessions', isCurrent: false },
  { key: 'midterm', label: 'Mid-term review', stateLabel: 'Upcoming', state: 'pending', link: null, isCurrent: false },
  { key: 'final', label: 'Final review', stateLabel: 'Upcoming', state: 'pending', link: null, isCurrent: false },
  { key: 'completion', label: 'Completion certificate', stateLabel: 'Upcoming', state: 'pending', link: null, isCurrent: false },
];

export default function DesignSystemPreview() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12 pb-24 sm:px-6">
      <header className="space-y-2">
        <p className="text-micro uppercase text-ink-3">Design System · §19</p>
        <h1 className="text-display text-ink">Component preview</h1>
        <p className="max-w-2xl text-body text-ink-2">
          The token layer (§1–§3) and the themed core component library (§4). Review here before the
          signature components (Journey Rail, bilingual field, AI container) and feature screens.
        </p>
      </header>

      <Section title="Palette">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {SWATCHES.map((s) => (
            <div key={s.name} className="space-y-1">
              <div
                className={`flex h-16 items-end rounded-md p-2 text-micro ${s.className} ${s.text ?? 'text-white'}`}
              >
                {s.name}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-2">
          <p className="text-display text-ink">Display — Poppins 36/44</p>
          <p className="text-h1 font-display text-ink">H1 — Poppins 28/36</p>
          <p className="text-h2 text-ink">H2 — Inter 20/28</p>
          <p className="text-h3 text-ink">H3 — Inter 16/24</p>
          <p className="text-body text-ink">Body — Inter 15/24, the default reading size.</p>
          <p className="text-small text-ink-2">Small — Inter 13/20, captions and helper text.</p>
          <p className="text-micro uppercase text-ink-3">Micro — eyebrows &amp; status pills</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Notifications">
            <Bell />
          </Button>
        </div>
      </Section>

      <Section title="Badges &amp; pills">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="ok">On track</Badge>
          <Badge variant="warn">Due soon</Badge>
          <Badge variant="risk">Overdue</Badge>
          <Badge variant="info">AI</Badge>
          <Badge variant="gold">Recognition</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid max-w-xl gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="e.g. Amina Bello" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lang">Preferred language</Label>
            <Select>
              <SelectTrigger id="lang">
                <SelectValue placeholder="Choose a language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes" variant="eyebrow">
              Session notes
            </Label>
            <Textarea id="notes" placeholder="Rough notes — the AI will structure them…" />
          </div>
        </div>
      </Section>

      <Section title="Cards &amp; stat tiles">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Active pairs" value="86" hint="of 92 matched" tone="ok" />
          <StatTile label="At-risk pairs" value="4" hint="no meeting in 30 days" tone="risk" />
          <StatTile label="Goals approved" value="73%" hint="212 of 290" tone="default" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>A calm surface for anything a person reads.</CardDescription>
            </CardHeader>
            <CardContent className="text-body text-ink-2">
              Cards over tables — generous space, one soft elevation, 12px radius.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>Progress bars and rings over bare numbers.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ProgressRing value={68} />
              <div className="flex-1 space-y-3">
                <Progress value={68} />
                <Progress value={40} tone="warn" />
                <Progress value={18} tone="risk" />
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex items-center gap-6">
          <Avatar>
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
          <AvatarGroup max={3}>
            <Avatar>
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>CD</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>EF</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>GH</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>IJ</AvatarFallback>
            </Avatar>
          </AvatarGroup>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="overview" className="max-w-xl">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-body text-ink-2">
            The pair&apos;s shared workspace at a glance.
          </TabsContent>
          <TabsContent value="goals" className="text-body text-ink-2">
            SMART goals with stage timelines.
          </TabsContent>
          <TabsContent value="sessions" className="text-body text-ink-2">
            Session logs and action items.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Overlays &amp; feedback">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule a session</DialogTitle>
                <DialogDescription>
                  Pick a time that works for both of you. We&apos;ll push it to Outlook.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost">Cancel</Button>
                <Button>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="secondary">Open drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerTitle>Quick action</DrawerTitle>
              <DrawerDescription>The shortest path, as a mobile bottom sheet.</DrawerDescription>
              <Button className="mt-2 w-full">Add session log</Button>
            </DrawerContent>
          </Drawer>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">Hover for tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>Goals · Your turn — Submit your goals →</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button onClick={() => toast({ title: 'Saved', description: 'Your changes synced.' })}>
            Show toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({ variant: 'destructive', title: 'Offline', description: 'Saved locally, will retry.' })
            }
          >
            Error toast
          </Button>
        </div>
      </Section>

      <Section title="Loading &amp; empty states">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Skeleton</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="No goals yet"
            description="Set your first SMART goal and your mentor will review it."
            action={<Button>Set a goal</Button>}
          />
        </div>
      </Section>

      <Section title="Data table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mentee</TableHead>
              <TableHead>Goals</TableHead>
              <TableHead>Last session</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Amina Bello</TableCell>
              <TableCell>3</TableCell>
              <TableCell>2 days ago</TableCell>
              <TableCell>
                <Badge variant="ok">On track</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Chidi Okeke</TableCell>
              <TableCell>2</TableCell>
              <TableCell>33 days ago</TableCell>
              <TableCell>
                <Badge variant="risk">At risk</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="AI &amp; bilingual cues (preview only — full components in §6/§7)">
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-md bg-info/10 px-3 py-2 text-small text-info">
            <Sparkles className="size-4" /> AI suggestion — editable before you save
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-small text-ink-2">
            <Languages className="size-4" /> EN · FR — translate on demand, source kept
          </span>
        </div>
      </Section>

      <Section title="Signature — Journey Rail (§5)">
        <p className="text-small text-ink-2">
          The persistent 9-step roadmap. States: done (filled), your turn (green ring + pulse),
          overdue/needs-action (amber/red ring + dot), upcoming (hollow). The line fills to the
          current step; nodes deep-link and show a tooltip. Resize to see horizontal ↔ vertical.
        </p>
        <JourneyRailView
          title="Your mentorship journey"
          progressLabel="44% complete"
          openLabel="Open"
          nodes={RAIL_NODES}
        />
      </Section>

      <Section title="Signature — Bilingual field (§6)">
        <div className="grid gap-6 sm:grid-cols-2">
          <BilingualField
            id="bf-why"
            name="why"
            label="Why this goal matters"
            placeholder="A sentence or two — in English or French…"
            helperText="Write in your language"
          />
          <div className="space-y-1.5">
            <p className="text-small font-medium text-ink-2">Saved content (reader&apos;s translate toggle)</p>
            <div className="rounded-md border border-border bg-surface p-3">
              <BilingualContent
                entityType="design-preview"
                entityId="sample-1"
                sourceLang="FR"
                text="Je veux améliorer ma communication avec les parties prenantes."
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Signature — AI container (§7)">
        <AIContainer
          title="Suggested session summary"
          hint="Editable"
          actions={
            <>
              <Button size="sm">Use suggestion</Button>
              <Button size="sm" variant="ghost">
                Edit
              </Button>
            </>
          }
        >
          <p>
            Discussed presentation skills and stakeholder confidence. Action: the mentee prepares a
            short presentation before the next session. Suggested next agenda: review the draft and
            practise delivery.
          </p>
        </AIContainer>
      </Section>

      <Fab aria-label="Quick actions">
        <Plus />
      </Fab>
      <Toaster />
    </div>
  );
}
