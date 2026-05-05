"use client";

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useFilters } from '@/hooks/useFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildCsv, downloadCsv, triggerPrint } from '@/lib/report-export';
import { AttendanceReportTabs } from '@/components/attendance-report-tabs';
import { AttendanceDateFilter } from '@/components/AttendanceDateFilter';
import { DateFormatBadge } from '@/components/DateDisplay';

function getMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export default function MonthlySummaryPage() {
  const { selectedBranchId, selectedDepartmentId } = useFilters();
  const initialBounds = getMonthBounds();
  const [startDate, setStartDate] = useState(initialBounds.startDate);
  const [endDate, setEndDate] = useState(initialBounds.endDate);
  const [dateFormat, setDateFormat] = useState<'ad' | 'bs'>('ad');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reportLabel = useMemo(() => {
    if (!startDate || !endDate) return 'Selected dates';
    return `${startDate} — ${endDate}`;
  }, [startDate, endDate]);

  async function loadReport(nextStart = startDate, nextEnd = endDate, nextFormat = dateFormat) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.dashboard.getMonthlySummary({
        startDate: nextStart,
        endDate: nextEnd,
        branchId: selectedBranchId,
        departmentId: selectedDepartmentId,
        dateFormat: nextFormat,
      });
      setData(res);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, selectedDepartmentId]);

  const rows = data?.summary || [];
  const totals = rows.reduce(
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
      ...rows.map((item: any, index: number) => [
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

  return (
    <div className="w-full min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className="mb-6 flex flex-col gap-3 print:hidden">
        <h1 className="text-3xl font-bold tracking-tight">Monthly Attendance Summary</h1>
        <p className="text-sm text-muted-foreground">Filter any date range and export the report as CSV or PDF.</p>
        <AttendanceReportTabs />

        <AttendanceDateFilter
          mode="range"
          initialDateFormat={dateFormat}
          initialStartDate={startDate}
          initialEndDate={endDate}
          applyLabel="Apply Range"
          onApply={({ startDate: nextStart, endDate: nextEnd, dateFormat: nextFormat }) => {
            setStartDate(nextStart);
            setEndDate(nextEnd);
            setDateFormat(nextFormat);
            void loadReport(nextStart, nextEnd, nextFormat);
          }}
        />

        {/* exports moved into table header - compact layout, remove duplicate info bar */}
      </div>

      <Card className="w-full min-w-0 border-border/60 shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <span>Monthly Summary</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-normal text-muted-foreground">{reportLabel}</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportCsv} disabled={!rows.length}>Export CSV</Button>
                <Button variant="outline" onClick={triggerPrint} disabled={!rows.length}>Export PDF</Button>
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
          ) : !rows.length ? (
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
                  {rows.map((item: any, index: number) => (
                    <TableRow key={item.employee?.id ?? index}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
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
    </div>
  );
}
