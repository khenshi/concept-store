import { ProductDirectory } from '@/features/products/product-directory';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <ProductDirectory organizationId={organizationId} />;
}
