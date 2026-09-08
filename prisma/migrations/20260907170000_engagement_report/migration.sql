-- Weekly engagement report: a new ReportKind so the automatically generated
-- report reuses the existing Report table, and therefore the existing Word and
-- Excel exporters.
ALTER TYPE "ReportKind" ADD VALUE IF NOT EXISTS 'ENGAGEMENT';
