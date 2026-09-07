import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  MerchantReport,
  MerchantDashboardData,
  ReportFilters,
  ReportsOverview,
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

export function getMerchantReport(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: ReportFilters = {},
): Promise<MerchantReport> {
  return request(withFilters(reportPath(organizationId, 'merchants'), filters));
}

export function getMerchantDashboard(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: Pick<ReportFilters, 'from' | 'to'> = {},
): Promise<MerchantDashboardData> {
  return request(
    withFilters(reportPath(organizationId, 'merchant-dashboard'), filters),
  );
}
