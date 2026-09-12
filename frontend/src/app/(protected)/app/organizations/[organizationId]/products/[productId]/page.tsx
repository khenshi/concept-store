import { ProductProfile } from '@/features/products/components/product-profile';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ organizationId: string; productId: string }>;
}) {
  const { organizationId, productId } = await params;
  return (
    <ProductProfile
      key={`${organizationId}/${productId}`}
      organizationId={organizationId}
      productId={productId}
    />
  );
}
