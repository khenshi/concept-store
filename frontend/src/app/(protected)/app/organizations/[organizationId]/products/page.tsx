import { ProductDirectory } from '@/features/products/product-directory';

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ merchantId?: string }>;
}) {
  const { organizationId } = await params;
  const { merchantId } = await searchParams;
  return (
    <ProductDirectory
      organizationId={organizationId}
      initialMerchantId={merchantId}
    />
  );
}
