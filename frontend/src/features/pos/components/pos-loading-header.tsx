import { PageHeader } from '@/shared/components/ui/page-header';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';

export function PosLoadingHeader({
  description = 'Scan or search products, then review the cart.',
  loading = true,
}: {
  description?: string;
  loading?: boolean;
}) {
  return (
    <PageHeader
      title="POS"
      description={description}
      className="!pb-5"
      action={
        loading ? (
          <div className="w-full min-w-0">
            <p className="mb-1 text-xs font-medium text-muted">POS branch</p>
            <ListSkeleton
              rows={1}
              rowClassName="min-h-11"
              className="mt-0"
              label="Loading POS branch selector"
            />
          </div>
        ) : undefined
      }
    />
  );
}
