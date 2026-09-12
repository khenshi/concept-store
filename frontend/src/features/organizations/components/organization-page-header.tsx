import type { OrganizationAccess } from '../model/organization.types';
import { PageHeader } from '@/shared/components/ui/page-header';

export function OrganizationPageHeader({
  title,
  description,
}: {
  organization: OrganizationAccess;
  title: string;
  description: string;
}) {
  return <PageHeader title={title} description={description} />;
}
