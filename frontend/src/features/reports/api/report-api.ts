import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  reportBranchesSchema,
  reportQuerySchema,
  staffSalesReportSchema,
  merchantSalesReportSchema,
  merchantSalesAnalyticsSchema,
  staffSalesAnalyticsSchema,
  type ReportQuery,
} from '../model/report.schemas';

export async function listReportBranches(
  request: AuthenticatedRequest,
  organizationId: string,
) {
  return reportBranchesSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(organizationId)}/reports/sales/branches`,
    ),
  );
}
export async function getStaffSalesReport(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportQuery,
) {
  const query = reportQuerySchema.parse(input);
  const report = staffSalesReportSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/reports/sales?${new URLSearchParams(query)}`,
    ),
  );
  if (
    report.branch.id !== branchId ||
    Date.parse(report.from) !== Date.parse(query.from) ||
    Date.parse(report.until) !== Date.parse(query.until)
  )
    throw new Error(
      'The report response does not match the selected branch and period.',
    );
  return report;
}

export async function getStaffSalesAnalytics(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportQuery,
) {
  const query = reportQuerySchema.parse(input);
  const report = staffSalesAnalyticsSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/reports/sales/analytics?${new URLSearchParams(query)}`,
    ),
  );
  if (
    report.branch.id !== branchId ||
    Date.parse(report.from) !== Date.parse(query.from) ||
    Date.parse(report.until) !== Date.parse(query.until)
  )
    throw new Error(
      'The analytics response does not match the selected branch and period.',
    );
  return report;
}

export async function getMerchantSalesReport(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportQuery,
) {
  const query = reportQuerySchema.parse(input);
  const report = merchantSalesReportSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/reports/sales?${new URLSearchParams(query)}`,
    ),
  );
  if (
    report.branch.id !== branchId ||
    Date.parse(report.from) !== Date.parse(query.from) ||
    Date.parse(report.until) !== Date.parse(query.until)
  )
    throw new Error(
      'The own-sales report response does not match the selected branch and period.',
    );
  return report;
}

export async function getMerchantSalesAnalytics(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportQuery,
) {
  const query = reportQuerySchema.parse(input);
  const report = merchantSalesAnalyticsSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/reports/sales/analytics?${new URLSearchParams(query)}`,
    ),
  );
  if (
    report.branch.id !== branchId ||
    Date.parse(report.from) !== Date.parse(query.from) ||
    Date.parse(report.until) !== Date.parse(query.until)
  )
    throw new Error(
      'The own-sales analytics response does not match the selected branch and period.',
    );
  return report;
}
