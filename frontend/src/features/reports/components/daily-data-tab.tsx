'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { RequestError } from '@/shared/components/ui/request-error';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { getReportDailyPage } from '../api/report-api';
import type {
  StaffDailyReportPage,
  MerchantDailyReportPage,
} from '../model/report.schemas';
import { StaffDailyData } from './staff-analytics-dashboard';
import { MerchantDailyData } from './merchant-analytics-dashboard';

export function DailyDataTab({
  organizationId,
  branchId,
  from,
  until,
  merchant,
  currentPage,
  onPageChange,
}: {
  organizationId: string;
  branchId: string;
  from: string;
  until: string;
  merchant: boolean;
  currentPage?: number;
  onPageChange?(page: number): void;
}) {
  const { request } = useAuth();
  const [localPage, setPage] = useState(1);
  const page = currentPage ?? localPage;
  const [data, setData] = useState<
    StaffDailyReportPage | MerchantDailyReportPage | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void getReportDailyPage(
      request,
      organizationId,
      branchId,
      { from, until, page, limit: 15 },
      merchant,
    )
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Daily data could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [
    request,
    organizationId,
    branchId,
    from,
    until,
    merchant,
    page,
    revision,
  ]);
  if (error)
    return (
      <RequestError
        message={error}
        onRetry={() => {
          setError(null);
          setRevision((value) => value + 1);
        }}
      />
    );
  if (!data) return <ListSkeleton label="Loading daily data" />;
  const changePage = (next: number) => {
    setData(null);
    setError(null);
    if (onPageChange) onPageChange(next);
    else setPage(next);
  };
  const pagination = (
    <PaginationControls
      ariaLabel="Daily data pagination"
      currentPage={data.page}
      totalPages={data.totalPages}
      hasNext={data.page < data.totalPages}
      summary={`${data.total} days`}
      onPrevious={() => changePage(page - 1)}
      onNext={() => changePage(page + 1)}
    />
  );
  return data.scope === 'STAFF' ? (
    <StaffDailyData rows={data.items} pagination={pagination} />
  ) : (
    <MerchantDailyData rows={data.items} pagination={pagination} />
  );
}
