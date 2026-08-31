import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  InventoryReport,
  MerchantReport,
  ReportFilters,
  ReportsOverview,
  SalesReport,
} from './report.types';

function reportPath(organizationId: string, report: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/reports/${report}`;
}

function withFilters(path: string, filters: ReportFilters): string {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return `${path}${query.size ? `?${query}` : ''}`;
}

export function getReportsOverview(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: ReportFilters = {},
): Promise<ReportsOverview> {
  return request(withFilters(reportPath(organizationId, 'overview'), filters));
}

export function getSalesReport(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: ReportFilters = {},
): Promise<SalesReport> {
  return request(withFilters(reportPath(organizationId, 'sales'), filters));
}

export function getInventoryReport(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: ReportFilters = {},
): Promise<InventoryReport> {
  return request(withFilters(reportPath(organizationId, 'inventory'), filters));
}

export function getMerchantReport(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: ReportFilters = {},
): Promise<MerchantReport> {
  return request(withFilters(reportPath(organizationId, 'merchants'), filters));
}
