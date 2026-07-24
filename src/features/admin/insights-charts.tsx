'use client';

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminInsights } from '@/features/admin/insights-data';

// Admin Insights charts (§12). Client-only (Recharts), fed pre-aggregated counts
// and pre-translated labels from the server page so it stays presentation-only.
// Colours are the design-system tokens (hard-coded hex so they reach the SVG
// reliably; CSS vars don't apply to recharts fills): green for the "good" series,
// amber `warn` for the "needs attention" series, neutral ink for muted.

const C = {
  green: '#288544',
  greenLight: '#34A853',
  greenStrong: '#1F7338',
  warn: '#C77A12',
  ink3: '#8A988F',
  border: '#E7EDE8',
} as const;

export interface ChartLabels {
  languageTitle: string;
  languageSubtitle: string;
  matchingTitle: string;
  matchingSubtitle: string;
  trainingTitle: string;
  trainingSubtitle: string;
  goalsTitle: string;
  goalsSubtitle: string;
  mentors: string;
  mentees: string;
  matched: string;
  unmatched: string;
  completed: string;
  pending: string;
  submitted: string;
  approved: string;
  goalCompleted: string;
  empty: string;
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-elevation">
      <div className="mb-4 space-y-0.5">
        <h2 className="font-display text-h3 font-semibold text-ink">{title}</h2>
        <p className="text-small text-ink-3">{subtitle}</p>
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </section>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  boxShadow: '0 8px 24px -6px rgba(16,42,26,.12)',
  fontSize: 13,
} as const;

const axisProps = {
  tick: { fill: C.ink3, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: C.border },
} as const;

export function InsightsCharts({
  data,
  labels,
}: {
  data: AdminInsights;
  labels: ChartLabels;
}) {
  const roleName = (g: 'mentors' | 'mentees') => (g === 'mentors' ? labels.mentors : labels.mentees);

  const matchingData = data.matching.map((m) => ({
    name: roleName(m.group),
    [labels.matched]: m.a,
    [labels.unmatched]: m.b,
  }));
  const trainingData = data.training.map((tr) => ({
    name: roleName(tr.group),
    [labels.completed]: tr.a,
    [labels.pending]: tr.b,
  }));
  const goalLabel: Record<string, string> = {
    submitted: labels.submitted,
    approved: labels.approved,
    completed: labels.goalCompleted,
  };
  const goalsData = data.goals.map((g) => ({ name: goalLabel[g.stage], value: g.count }));
  const goalColors = [C.greenStrong, C.green, C.greenLight];

  const hasLanguages = data.languages.some((l) => l.count > 0);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Language distribution — donut */}
      <ChartCard title={labels.languageTitle} subtitle={labels.languageSubtitle}>
        {hasLanguages ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.languages.map((l) => ({ name: l.language, value: l.count }))}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={0}
              >
                {/* QA-INSIGHT-004: two perceptually-distinct hues for the EN/FR
                    categorical series (was two near-identical greens). */}
                <Cell fill={C.green} />
                <Cell fill={C.warn} />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={labels.empty} />
        )}
      </ChartCard>

      {/* Matching status — stacked bar */}
      <ChartCard title={labels.matchingTitle} subtitle={labels.matchingSubtitle}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={matchingData} barSize={48}>
            <CartesianGrid vertical={false} stroke={C.border} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(40,133,68,.06)' }} />
            <Legend iconType="circle" />
            <Bar dataKey={labels.matched} stackId="m" fill={C.green} radius={[0, 0, 0, 0]} />
            <Bar dataKey={labels.unmatched} stackId="m" fill={C.warn} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Training completion — stacked bar */}
      <ChartCard title={labels.trainingTitle} subtitle={labels.trainingSubtitle}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trainingData} barSize={48}>
            <CartesianGrid vertical={false} stroke={C.border} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(40,133,68,.06)' }} />
            <Legend iconType="circle" />
            <Bar dataKey={labels.completed} stackId="t" fill={C.green} />
            <Bar dataKey={labels.pending} stackId="t" fill={C.ink3} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Goal pipeline — bar */}
      <ChartCard title={labels.goalsTitle} subtitle={labels.goalsSubtitle}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={goalsData} barSize={56}>
            <CartesianGrid vertical={false} stroke={C.border} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(40,133,68,.06)' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {goalsData.map((_, i) => (
                <Cell key={i} fill={goalColors[i % goalColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-small text-ink-3">{label}</div>
  );
}
