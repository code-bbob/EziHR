"use client";

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useFilters } from '@/hooks/useFilters';
import { useDateFormatPreference } from '@/hooks/use-date-format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildCsv, downloadCsv, getRangeDates } from '@/lib/report-export';
import { buildDetailedMonthlySummaryPdf } from '@/lib/pdf-export';
import { AttendanceReportTabs } from '@/components/attendance-report-tabs';
import { Input } from '@/components/ui/input';
import { AttendanceDateFilter } from '@/components/AttendanceDateFilter';
import { getDaysInMonth, getTodayDate } from 'bs-ad-calendar-react';

function padDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: padDate(start),
    endDate: padDate(end),
  };
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

function formatDayLabel(dateValue: string, dateFormat: 'ad' | 'bs') {
  // Nepali month names (transliterated)
  const nepaliMonths = [
    'Baishakh',
    'Jestha',
    'Ashadh',
    'Shrawan',
    'Bhadra',
    'Ashwin',
    'Kartik',
    'Mangsir',
    'Poush',
    'Magh',
    'Falgun',
    'Chaitra',
  ];

  if (dateFormat === 'bs') {
    // Expecting dateValue in YYYY-MM-DD (BS) format
    const parts = dateValue.split('-').map((p) => Number(p));
    const [y, m, d] = parts;
    if (![y, m, d].every((v) => Number.isFinite(v))) {
      return { firstLine: dateValue, secondLine: '' };
    }

    const monthName = nepaliMonths[(m || 1) - 1] || nepaliMonths[0];
    return {
      firstLine: `${monthName} ${d}`,
      secondLine: `(${y})`,
    };
  }

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return {
      firstLine: dateValue,
      secondLine: '',
    };
  }

  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(date);
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);

  return {
    firstLine: `${month} ${day}`,
    secondLine: `(${weekday})`,
  };
}

export default function MonthlySummaryDetailedPage() {
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

  const reportDates = useMemo(() => getRangeDates(startDate, endDate, currentDateFormat), [startDate, endDate, currentDateFormat]);

  const reportLabel = useMemo(() => {
    return startDate && endDate ? `${startDate} — ${endDate}` : 'Selected dates';
  }, [startDate, endDate]);

  const rows = data?.rows || [];
  const itemsPerPage = pageSize || 30;
  const effectiveRows = showAll ? allRows : rows;
  const totalPages = Math.max(1, Math.ceil((totalCount || effectiveRows.length) / itemsPerPage));
  const displayStart = showAll ? (effectiveRows.length ? 1 : 0) : ((currentPage - 1) * itemsPerPage + 1);
  const displayEnd = showAll ? Math.min(effectiveRows.length, effectiveRows.length) : (displayStart + (rows.length ? rows.length - 1 : 0));
  const paginatedRows = effectiveRows;

  useEffect(() => {
    if (datePrefLoading) return;
    if (initializedRange && currentDateFormat === dateFormat) return;

    const initialBounds = getMonthBoundsForFormat(dateFormat);
    console.debug('[monthly-summary-detailed] init-range', {
      dateFormat,
      initialBounds,
    });
    setStartDate(initialBounds.startDate);
    setEndDate(initialBounds.endDate);
    setCurrentDateFormat(dateFormat);
    setInitializedRange(true);
  }, [dateFormat, datePrefLoading, initializedRange, currentDateFormat]);

  async function loadReport(nextStart = startDate, nextEnd = endDate, nextFormat = currentDateFormat) {
    if (!nextStart || !nextEnd) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.dashboard.getMonthlySummaryDetailed({
        startDate: nextStart,
        endDate: nextEnd,
        branchId: selectedBranchId,
        departmentId: selectedDepartmentId,
        dateFormat: nextFormat,
      });
      setData(res);
      const pagination = res?.pagination || {};
      setTotalCount(typeof res?.count === 'number' ? res.count : (pagination.count || (Array.isArray(res?.rows) ? res.rows.length : 0)));
      setPageSize(pagination.page_size || 30);
      setCurrentPage(pagination.page || 1);
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
      const res = await apiClient.request<any>(`/attendance/api/reports/monthly-summary-detailed/${queryString ? `?${queryString}` : ''}`);
      setData(res);
      const pagination = res?.pagination || {};
      setTotalCount(typeof res?.count === 'number' ? res.count : (pagination.count || (Array.isArray(res?.rows) ? res.rows.length : 0)));
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
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, selectedDepartmentId, currentDateFormat, datePrefLoading, initializedRange, startDate, endDate]);

  // Update currentDateFormat when enterprise preference changes
  useEffect(() => {
    setCurrentDateFormat(dateFormat);
  }, [dateFormat]);

  const handleExportCsv = () => {
    const csv = buildCsv([
      ['S.N.', 'Employee', 'Code', ...reportDates, 'Present Days', 'Absent Days', 'Late Days', 'Worked Hours'],
      ...(data?.rows || []).map((item: any, index: number) => {
        const dayValues = (item.days || []).map((day: any) => {
          if (!day?.present) return 'A';
          if (Number(day?.late_seconds || 0) > 0) return 'L';
          if (Number(day?.early_seconds || 0) > 0) return 'E';
          return 'P';
        });

        const presentDays = dayValues.filter((v: string) => v !== 'A').length;
        const absentDays = dayValues.filter((v: string) => v === 'A').length;
        const lateDays = item.days?.filter((d: any) => Number(d?.late_seconds || 0) > 0).length || 0;
        const workedHours = item.days?.reduce((sum: number, d: any) => sum + Number(d?.worked_hours || 0), 0) || 0;

        return [
          index + 1,
          item.employee?.name || 'Unknown',
          item.employee?.employee_code || '-',
          ...dayValues,
          presentDays,
          absentDays,
          lateDays,
          workedHours.toFixed(2),
        ];
      }),
    ]);

    downloadCsv(`detailed-monthly-summary-${startDate}-to-${endDate}.csv`, csv);
  };

  const handleExportPdf = () => {
    const rowsToExport = showAll ? allRows : (data?.rows || []);
    if (!rowsToExport.length) return;
    buildDetailedMonthlySummaryPdf(
      rowsToExport,
      `${startDate} to ${endDate}`,
      `detailed-monthly-summary-${startDate}-to-${endDate}.pdf`,
      reportDates,
      currentDateFormat
    );
  };

  return (
    <div className="w-full max-w-full min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-3 print:hidden">
        <h1 className="text-3xl font-bold">Detailed Monthly Attendance Summary</h1>
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
              void loadReport(nextStart, nextEnd, nextFormat);
            }}
          />
        )}

        <div className="flex flex-wrap items-center gap-4 mt-2 print:hidden">
          <div className="ml-auto flex gap-2">
            <Button variant="outline" className="rounded-full px-6" onClick={handleExportCsv} disabled={!data?.rows?.length}>
              Export CSV
            </Button>
            <Button variant="outline" className="rounded-full px-6" onClick={handleExportPdf} disabled={!data?.rows?.length}>
              Export PDF
            </Button>
            <Button
              variant={showAll ? 'secondary' : 'outline'}
              className="rounded-full px-6"
              onClick={async () => {
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
                    const response = await apiClient.request<any>(`/attendance/api/reports/monthly-summary-detailed/${queryString ? `?${queryString}` : ''}`);
                    const pageRows = Array.isArray(response?.rows) ? response.rows : [];
                    results.push(...pageRows);
                    if (pageRows.length === 0 || !response?.pagination?.next) break;
                    page += 1;
                  }
                  setAllRows(results);
                  setShowAll(true);
                } catch (err) {
                  console.error('Failed to load all monthly detailed pages', err);
                }
              }}
            >
              {showAll ? 'Showing all' : 'Show all'}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between">
            <span>Detailed Monthly Summary</span>
            <span className="text-sm text-muted-foreground">{reportLabel}</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="p-6 text-red-500">{error}</div>
          ) : !data?.rows?.length ? (
            <div className="p-6 text-sm text-muted-foreground">No data</div>
          ) : (
            <div className="w-full px-2  overflow-x-auto">
              <Table className="min-w-max ">
                <TableHeader className=''>
                  <TableRow>
                    <TableHead>S.N.</TableHead>
                    <TableHead>Employee</TableHead>

                    {reportDates.map((d) => {
                      const { firstLine, secondLine } = formatDayLabel(d, currentDateFormat);

                      return (
                        <TableHead key={d}>
                          <div className="leading-tight">
                            <div>{firstLine}</div>
                            <div>{secondLine}</div>
                          </div>
                        </TableHead>
                      );
                    })}

                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Hours</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedRows.map((item: any, i: number) => {
                    console.log(item);
                    const dayValues = (item.days || []).map((day: any) => {
                      if (!day?.present) return 'A';
                      if (day.late_seconds > 0) return 'L';
                      if (day.early_seconds > 0) return 'E';
                      return 'P';
                    });

                    return (
                      <TableRow key={i}>
                        <TableCell>{displayStart + i}</TableCell>
                        <TableCell>{item.employee?.name}</TableCell>
                        {dayValues.map((v: string, j: number) => {
                          let colorClass = '';
                          if (v === 'P') colorClass = 'text-emerald-600 ';
                          else if (v === 'A') colorClass = 'text-rose-600 ';
                          else if (v === 'L') colorClass = 'text-amber-500';
                          else if (v === 'E') colorClass = 'text-blue-500 ';

                          return (
                            <TableCell key={j} className={`text-center ${colorClass}`}>
                              {v}
                            </TableCell>
                          );
                        })}

                        <TableCell>{dayValues.filter((v: string) => v !== 'A').length}</TableCell>
                        <TableCell>{dayValues.filter((v: string) => v === 'A').length}</TableCell>
                        <TableCell>{item.days.filter((d: any) => d.late_seconds > 0).length}</TableCell>
                        <TableCell>
                          {item.days.reduce((s: number, d: any) => s + Number(d.worked_hours || 0), 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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