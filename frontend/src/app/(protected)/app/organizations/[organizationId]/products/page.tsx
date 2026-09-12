import { ProductDirectory } from '@/features/products/components/product-directory';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return (
    <ProductDirectory key={organizationId} organizationId={organizationId} />
  );
}
