import type { ReactNode } from 'react';
import { PosWorkspace } from '@/features/pos/components/pos-workspace';

export default async function PosLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const scope = await params;
  return <PosWorkspace {...scope}>{children}</PosWorkspace>;
}
