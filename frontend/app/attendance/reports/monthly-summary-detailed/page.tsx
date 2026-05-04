"use client";

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useFilters } from '@/hooks/useFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildCsv, downloadCsv, getRangeDates, triggerPrint } from '@/lib/report-export';
import { AttendanceReportTabs } from '@/components/attendance-report-tabs';

function getMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function formatDayLabel(dateValue: string) {
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
  const initialBounds = getMonthBounds();

  const [startDate, setStartDate] = useState(initialBounds.startDate);
  const [endDate, setEndDate] = useState(initialBounds.endDate);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reportDates = useMemo(() => getRangeDates(startDate, endDate), [startDate, endDate]);

  const reportLabel = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Selected dates';

    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return `${formatter.format(start)} — ${formatter.format(end)}`;
  }, [startDate, endDate]);

  async function loadReport() {
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.dashboard.getMonthlySummaryDetailed({
        startDate,
        endDate,
        branchId: selectedBranchId,
        departmentId: selectedDepartmentId,
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

  return (
    <div className="w-full max-w-full min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-3 print:hidden">
        <h1 className="text-3xl font-bold">Detailed Monthly Attendance Summary</h1>
        <p className="text-sm text-muted-foreground">Filter any date range and export the report as CSV or PDF.</p>
        <AttendanceReportTabs />

        <div className="flex flex-col gap-3 border rounded-lg p-4 lg:flex-row lg:justify-between">
          <div className="flex gap-3">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button onClick={loadReport}>Apply</Button>
            <Button variant="outline" onClick={handleExportCsv} disabled={!data?.rows?.length}>
              Export CSV
            </Button>
            <Button variant="outline" onClick={triggerPrint} disabled={!data?.rows?.length}>
              Export PDF
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
                      const { firstLine, secondLine } = formatDayLabel(d);

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
                  {data.rows.map((item: any, i: number) => {
                    const dayValues = (item.days || []).map((day: any) => {
                      if (!day?.present) return 'A';
                      if (day.late_seconds > 0) return 'L';
                      if (day.early_seconds > 0) return 'E';
                      return 'P';
                    });

                    return (
                      <TableRow key={i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{item.employee?.name}</TableCell>
                        {dayValues.map((v: string, j: number) => (
                          <TableCell key={j} className="text-center">
                            {v}
                          </TableCell>
                        ))}

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
    </div>
  );
}