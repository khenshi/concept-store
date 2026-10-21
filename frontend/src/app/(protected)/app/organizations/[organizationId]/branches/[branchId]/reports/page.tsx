import { redirect } from 'next/navigation';
export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId, branchId } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value);
  }
  redirect(
    `/app/organizations/${organizationId}/branches/${branchId}/reports/overview${query.size ? `?${query}` : ''}`,
  );
}
