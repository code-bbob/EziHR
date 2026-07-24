"use client";

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useFilters } from '@/hooks/useFilters';
import { useDateFormatPreference } from '@/hooks/use-date-format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildCsv, downloadCsv } from '@/lib/report-export';
import { buildMonthlySummaryPdf } from '@/lib/pdf-export';
import { AttendanceReportTabs } from '@/components/attendance-report-tabs';
import { AttendanceDateFilter } from '@/components/AttendanceDateFilter';
import { getDaysInMonth, getTodayDate } from 'bs-ad-calendar-react';

function padDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthBoundsForFormat(format: 'ad' | 'bs') {
  if (format === 'bs') {
    const todayBs = getTodayDate('BS');
    const today = `${todayBs.year}-${String(todayBs.month + 1).padStart(2, '0')}-${String(todayBs.day).padStart(2, '0')}`;
    const monthStart = `${todayBs.year}-${String(todayBs.month + 1).padStart(2, '0')}-01`;
    return {
      startDate: monthStart,
      endDate: today,
    };
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = padDate(now);

  return {
    startDate: padDate(start),
    endDate: today,
  };
}

export default function MonthlySummaryPage() {
  const { selectedBranchId, selectedDepartmentId } = useFilters();
  const { dateFormat, loading: datePrefLoading } = useDateFormatPreference();
  const [initializedRange, setInitializedRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentDateFormat, setCurrentDateFormat] = useState<'ad' | 'bs'>(dateFormat);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(30);

  const reportLabel = useMemo(() => {
    if (!startDate || !endDate) return 'Selected dates';
    return `${startDate} — ${endDate}`;
  }, [startDate, endDate]);

  useEffect(() => {
    if (datePrefLoading) return;
    if (initializedRange && currentDateFormat === dateFormat) return;

    const initialBounds = getMonthBoundsForFormat(dateFormat);
    setStartDate(initialBounds.startDate);
    setEndDate(initialBounds.endDate);
    setCurrentDateFormat(dateFormat);
    setInitializedRange(true);
  }, [dateFormat, datePrefLoading, initializedRange, currentDateFormat]);

  async function loadReport(page = 1, nextStart = startDate, nextEnd = endDate, nextFormat = currentDateFormat) {
    if (!nextStart || !nextEnd) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branch_id', String(selectedBranchId));
      if (selectedDepartmentId) params.append('department_id', String(selectedDepartmentId));
      params.append('date_format', nextFormat);
      params.append('start_date', nextStart);
      params.append('end_date', nextEnd);
      params.append('page', String(page));

      const queryString = params.toString();
      const res = await apiClient.request<any>(`/attendance/api/reports/monthly-summary/${queryString ? `?${queryString}` : ''}`);

      setData(res);
      const pagination = res?.pagination || {};
      setTotalCount(typeof res?.count === 'number' ? res.count : (pagination.count || (Array.isArray(res?.summary) ? res.summary.length : 0)));
      setPageSize(pagination.page_size || 30);
      setCurrentPage(pagination.page || page);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadPage(page: number) {
    const params = new URLSearchParams();
    if (selectedBranchId) params.append('branch_id', String(selectedBranchId));
    if (selectedDepartmentId) params.append('department_id', String(selectedDepartmentId));
    params.append('date_format', currentDateFormat);
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    params.append('page', String(page));

    const queryString = params.toString();
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.request<any>(`/attendance/api/reports/monthly-summary/${queryString ? `?${queryString}` : ''}`);
      setData(res);
      const pagination = res?.pagination || {};
      setTotalCount(typeof res?.count === 'number' ? res.count : (pagination.count || (Array.isArray(res?.summary) ? res.summary.length : 0)));
      setPageSize(pagination.page_size || 30);
      setCurrentPage(pagination.page || page);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (datePrefLoading || !initializedRange) return;
    loadReport(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, selectedDepartmentId, currentDateFormat, datePrefLoading, initializedRange, startDate, endDate]);

  useEffect(() => {
    setCurrentDateFormat(dateFormat);
  }, [dateFormat]);

  const rows = data?.summary || [];
  const itemsPerPage = pageSize || 30;
  const effectiveRows = showAll ? allRows : rows;
  const totalPages = Math.max(1, Math.ceil((totalCount || effectiveRows.length) / itemsPerPage));
  const displayStart = showAll ? (effectiveRows.length ? 1 : 0) : ((currentPage - 1) * itemsPerPage + 1);
  const displayEnd = showAll ? effectiveRows.length : (displayStart + (rows.length ? rows.length - 1 : 0));
  const paginatedRows = effectiveRows;

  const totals = (showAll ? allRows : rows).reduce(
    (acc: any, item: any) => {
      acc.totalDays += Number(item.total_days || 0);
      acc.presentDays += Number(item.present_days || 0);
      acc.absentDays += Number(item.absent_days || 0);
      acc.lateDays += Number(item.late_days || 0);
      acc.workedHours += Number(item.worked_hours || 0);
      return acc;
    },
    { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0, workedHours: 0 }
  );

  const handleExportCsv = () => {
    const csv = buildCsv([
      ['S.N.', 'Employee', 'Code', 'Total Days', 'Present Days', 'Absent Days', 'Late Days', 'Worked Hours'],
      ...(showAll ? allRows : rows).map((item: any, index: number) => [
        index + 1,
        item.employee?.name || 'Unknown',
        item.employee?.employee_code || '-',
        item.total_days ?? '-',
        item.present_days ?? '-',
        item.absent_days ?? '-',
        item.late_days ?? '-',
        typeof item.worked_hours === 'number' ? item.worked_hours.toFixed(2) : '-',
      ]),
    ]);
    downloadCsv(`monthly-summary-${startDate}-to-${endDate}.csv`, csv);
  };

  const handleExportPdf = () => {
    const rowsToExport = showAll ? allRows : rows;
    if (!rowsToExport.length) return;
    buildMonthlySummaryPdf(
      rowsToExport,
      `${startDate} to ${endDate}`,
      `monthly-summary-${startDate}-to-${endDate}.pdf`,
      totals
    );
  };

  const handleShowAll = async () => {
    if (showAll) {
      setShowAll(false);
      setAllRows([]);
      setCurrentPage(1);
      return;
    }

    const params = new URLSearchParams();
    if (selectedBranchId) params.append('branch_id', String(selectedBranchId));
    if (selectedDepartmentId) params.append('department_id', String(selectedDepartmentId));
    params.append('date_format', currentDateFormat);
    params.append('start_date', startDate);
    params.append('end_date', endDate);

    const baseQuery = params.toString();
    let page = 1;
    const results: any[] = [];

    try {
      while (true) {
        const pageParams = new URLSearchParams(baseQuery);
        pageParams.append('page', String(page));
        const queryString = pageParams.toString();
        const response = await apiClient.request<any>(`/attendance/api/reports/monthly-summary/${queryString ? `?${queryString}` : ''}`);
        const pageRows = Array.isArray(response?.summary) ? response.summary : [];
        results.push(...pageRows);
        if (pageRows.length === 0 || !response?.pagination?.next) break;
        page += 1;
      }
      setAllRows(results);
      setShowAll(true);
    } catch (err) {
      console.error('Failed to load all monthly summary pages', err);
    }
  };

  return (
    <div className="w-full min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className="mb-6 flex flex-col gap-3 print:hidden">
        <h1 className="text-3xl font-bold tracking-tight">Monthly Attendance Summary</h1>
        <p className="text-sm text-muted-foreground">Filter any date range and export the report as CSV or PDF.</p>
        <AttendanceReportTabs />

        {initializedRange && (
          <AttendanceDateFilter
            mode="range"
            initialDateFormat={currentDateFormat}
            initialStartDate={startDate}
            initialEndDate={endDate}
            applyLabel="Apply Range"
            onApply={({ startDate: nextStart, endDate: nextEnd, dateFormat: nextFormat }) => {
              setStartDate(nextStart);
              setEndDate(nextEnd);
              setCurrentDateFormat(nextFormat);
              void loadReport(1, nextStart, nextEnd, nextFormat);
            }}
          />
        )}

      </div>

      <Card className="w-full min-w-0 border-border/60 shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <span>Monthly Summary</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-normal text-muted-foreground">{reportLabel}</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportCsv} disabled={!(showAll ? allRows.length : rows.length)}>Export CSV</Button>
                <Button variant="outline" onClick={handleExportPdf} disabled={!(showAll ? allRows.length : rows.length)}>Export PDF</Button>
                <Button variant={showAll ? 'secondary' : 'outline'} onClick={handleShowAll} className="rounded-2xl">
                  {showAll ? 'Showing all' : 'Show all'}
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="mb-3 h-10 w-full" />
              <Skeleton className="mb-3 h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="p-6 text-rose-600">Error: {error}</div>
          ) : !(showAll ? allRows.length : rows.length) ? (
            <div className="p-6 text-sm text-muted-foreground">No data for the selected dates.</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <div className="min-w-max px-2">
                <Table className="w-max min-w-full">
                  <TableHeader className="bg-background">
                    <TableRow>
                      <TableHead className="w-20">S.N.</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead className="w-24 text-right">Total Days</TableHead>
                      <TableHead className="w-24 text-right">Present</TableHead>
                      <TableHead className="w-24 text-right">Absent</TableHead>
                      <TableHead className="w-24 text-right">Late</TableHead>
                      <TableHead className="w-32 text-right">Worked Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((item: any, index: number) => (
                      <TableRow key={item.employee?.id ?? index}>
                        <TableCell className="font-medium">{displayStart + index}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{item.employee?.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">{item.employee?.employee_code || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.total_days ?? '-'}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">{item.present_days ?? '-'}</TableCell>
                        <TableCell className="text-right font-medium text-rose-600">{item.absent_days ?? '-'}</TableCell>
                        <TableCell className="text-right font-medium text-amber-600">{item.late_days ?? '-'}</TableCell>
                        <TableCell className="text-right font-medium">{typeof item.worked_hours === 'number' ? item.worked_hours.toFixed(2) : '-'}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell colSpan={2} className="text-right">Totals</TableCell>
                      <TableCell className="text-right">{totals.totalDays}</TableCell>
                      <TableCell className="text-right text-emerald-600">{totals.presentDays}</TableCell>
                      <TableCell className="text-right text-rose-600">{totals.absentDays}</TableCell>
                      <TableCell className="text-right text-amber-600">{totals.lateDays}</TableCell>
                      <TableCell className="text-right">{totals.workedHours.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {(showAll ? allRows.length : rows.length) > 0 && (
        <div className="mt-4 px-2">
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <div>
              {showAll ? (
                <>Showing all {allRows.length} records</>
              ) : (
                <>Showing {displayStart}–{displayEnd} of {totalCount} records</>
              )}
            </div>

            {!showAll && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => loadPage(Math.max(currentPage - 1, 1))} disabled={currentPage === 1} className="rounded-full">Previous</Button>
                <div className="text-sm font-medium">Page {currentPage} of {totalPages}</div>
                <Button variant="outline" size="sm" onClick={() => loadPage(Math.min(currentPage + 1, totalPages))} disabled={currentPage === totalPages} className="rounded-full">Next</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
