'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Print / save-as-PDF the certificate. The page's print stylesheet isolates
// #certificate to a full A4 landscape sheet, so the browser's native "Save as PDF"
// produces a clean certificate the participant can download and share.
export function CertificatePrintButton({ label }: { label: string }) {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer className="mr-2 size-4" />
      {label}
    </Button>
  );
}
