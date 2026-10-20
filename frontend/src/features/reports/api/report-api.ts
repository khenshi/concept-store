import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import { z } from 'zod';
import {
  reportBranchesSchema,
  reportQuerySchema,
  staffSalesReportSchema,
  merchantSalesReportSchema,
  merchantSalesAnalyticsSchema,
  merchantSalesRankingPageSchema,
  reportRankingQuerySchema,
  staffSalesAnalyticsSchema,
  staffSalesRankingPageSchema,
  merchantTransactionsPageSchema,
  reportTransactionQuerySchema,
  staffTransactionsPageSchema,
  reportDailyQuerySchema,
  staffDailyReportPageSchema,
  merchantDailyReportPageSchema,
  reportBranchSchema,
  type ReportDailyQuery,
  type ReportQuery,
  type ReportRankingQuery,
  type ReportTransactionQuery,
} from '../model/report.schemas';

const resolvedPeriodSchema = z
  .object({
    scope: z.enum(['STAFF', 'MERCHANT']),
    branch: reportBranchSchema,
    from: z.string().datetime().nullable(),
    until: z.string().datetime(),
    hasActivity: z.boolean(),
  })
  .strict()
  .refine((period) => period.hasActivity === (period.from !== null));

export async function resolveReportPeriod(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  until: string,
  merchant: boolean,
) {
  const period = resolvedPeriodSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/reports/sales/period?${new URLSearchParams({ mode: 'ALL_TIME', until })}`,
    ),
  );
  if (
    period.branch.id !== branchId ||
    period.scope !== (merchant ? 'MERCHANT' : 'STAFF') ||
    Date.parse(period.until) !== Date.parse(until) ||
    (period.from !== null &&
      !reportQuerySchema.safeParse({ from: period.from, until: period.until })
        .success)
  )
    throw new Error(
      'The all-time period does not match the selected branch or scope.',
    );
  return period;
}

export async function getReportDailyPage(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportDailyQuery,
  merchant: boolean,
) {
  const query = reportDailyQuerySchema.parse(input);
  const params = new URLSearchParams({
    from: query.from,
    until: query.until,
    page: String(query.page),
    limit: String(query.limit),
  });
  const raw = await request<unknown>(
    `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/reports/sales/daily?${params}`,
  );
  const page = (
    merchant ? merchantDailyReportPageSchema : staffDailyReportPageSchema
  ).parse(raw);
  if (
    page.branch.id !== branchId ||
    page.scope !== (merchant ? 'MERCHANT' : 'STAFF') ||
    Date.parse(page.from) !== Date.parse(query.from) ||
    Date.parse(page.until) !== Date.parse(query.until) ||
    page.page !== query.page ||
    page.limit !== query.limit
  )
    throw new Error(
      'The daily data does not match the selected branch, period or page.',
    );
  return page;
}

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

async function getTransactions(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportTransactionQuery,
  merchant: boolean,
) {
  const query = reportTransactionQuerySchema.parse(input);
  const params = new URLSearchParams({
    from: query.from,
    until: query.until,
    page: String(query.page),
    limit: String(query.limit),
    ...(query.type ? { type: query.type } : {}),
    ...(query.q ? { q: query.q } : {}),
  });
  const raw = await request<unknown>(
    `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/reports/transactions?${params}`,
  );
  const page = (
    merchant ? merchantTransactionsPageSchema : staffTransactionsPageSchema
  ).parse(raw);
  if (
    page.scope !== (merchant ? 'MERCHANT' : 'STAFF') ||
    page.branch.id !== branchId ||
    Date.parse(page.from) !== Date.parse(query.from) ||
    Date.parse(page.until) !== Date.parse(query.until) ||
    page.page !== query.page ||
    page.limit !== query.limit ||
    new Set(page.items.map((item) => item.id)).size !== page.items.length
  )
    throw new Error(
      'The transactions response does not match the selected branch, period or page.',
    );
  return page;
}

export function getStaffTransactions(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportTransactionQuery,
) {
  return getTransactions(request, organizationId, branchId, input, false);
}

export function getMerchantTransactions(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportTransactionQuery,
) {
  return getTransactions(request, organizationId, branchId, input, true);
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

export async function getStaffSalesRankings(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportRankingQuery,
) {
  const query = reportRankingQuerySchema.parse(input);
  const report = staffSalesRankingPageSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/reports/sales/rankings?${new URLSearchParams(
        {
          from: query.from,
          until: query.until,
          page: String(query.page),
          sortBy: query.sortBy,
          ...(query.merchantId ? { merchantId: query.merchantId } : {}),
        },
      )}`,
    ),
  );
  if (
    report.scope !== 'STAFF' ||
    report.branch.id !== branchId ||
    Date.parse(report.from) !== Date.parse(query.from) ||
    Date.parse(report.until) !== Date.parse(query.until) ||
    report.page !== query.page ||
    report.sortBy !== query.sortBy ||
    report.merchantId !== (query.merchantId ?? null)
  )
    throw new Error(
      'The ranking response does not match the selected branch, period or page.',
    );
  return report;
}

export async function getMerchantSalesRankings(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: ReportRankingQuery,
) {
  const query = reportRankingQuerySchema.parse(input);
  const report = merchantSalesRankingPageSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/reports/sales/rankings?${new URLSearchParams(
        {
          from: query.from,
          until: query.until,
          page: String(query.page),
          sortBy: query.sortBy,
          ...(query.merchantId ? { merchantId: query.merchantId } : {}),
        },
      )}`,
    ),
  );
  if (
    report.scope !== 'MERCHANT' ||
    report.branch.id !== branchId ||
    Date.parse(report.from) !== Date.parse(query.from) ||
    Date.parse(report.until) !== Date.parse(query.until) ||
    report.page !== query.page ||
    report.sortBy !== query.sortBy ||
    report.merchantId !== (query.merchantId ?? null)
  )
    throw new Error(
      'The ranking response does not match the selected branch, period or page.',
    );
  return report;
}
