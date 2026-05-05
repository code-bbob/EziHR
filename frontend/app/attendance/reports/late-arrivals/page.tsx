"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useFilters } from '@/hooks/useFilters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceReportTabs } from '@/components/attendance-report-tabs';
import { AttendanceDateFilter } from '@/components/AttendanceDateFilter';
import { DateFormatBadge } from '@/components/DateDisplay';

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function LateArrivalsReport() {
  const { selectedBranchId, selectedDepartmentId } = useFilters();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(getToday());
  const [dateFormat, setDateFormat] = useState<'ad' | 'bs'>('ad');

  const reportLabel = useMemo(() => attendanceDate, [attendanceDate]);

  const loadReport = useCallback(async (nextDate = attendanceDate) => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.dashboard.getLateArrivals(selectedBranchId, selectedDepartmentId, nextDate);
      setData(res);
    } catch (err) {
      console.error(err);
      setError(String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [attendanceDate, selectedBranchId, selectedDepartmentId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <div className="w-full flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <header className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Late Arrivals Report</h1>
          <p className="text-sm text-muted-foreground">Generated for: {reportLabel}</p>
					<AttendanceReportTabs />
        </div>

        <AttendanceDateFilter
          mode="single"
          initialDateFormat={dateFormat}
          initialDate={attendanceDate}
          applyLabel="Apply Date"
          onApply={({ startDate: nextDate, dateFormat: nextFormat }) => {
            setAttendanceDate(nextDate);
            setDateFormat(nextFormat);
            void loadReport(nextDate);
          }}
        />

        {/* moved applied-date and actions into the table header for a compact layout */}
      </header>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center justify-between">
            <span>Late Arrivals</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-normal text-muted-foreground">{reportLabel}</span>
              <DateFormatBadge format={dateFormat} />
              <Button onClick={() => loadReport()} className="sm:shrink-0">Refresh</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-10 w-full mb-3" />
              <Skeleton className="h-10 w-full mb-3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="p-6 text-rose-600">Error: {error}</div>
          ) : (!data || !data.late_arrivals || !data.late_arrivals.length) ? (
            <div className="p-6 text-sm text-muted-foreground">No late arrivals for the selected date/filters.</div>
          ) : (
            <div className="overflow-x-auto px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.N.</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Actual Time</TableHead>
                    <TableHead>Delay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.late_arrivals.map((item: any, idx: number) => (
                    <TableRow key={item.employee?.id || idx}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>{item.employee?.name || item.employee?.employee_name || 'Unknown'}</TableCell>
                      <TableCell>{item.scheduled_arrival ? new Date(item.scheduled_arrival).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</TableCell>
                      <TableCell className="text-rose-600">{item.check_in ? new Date(item.check_in).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</TableCell>
                      <TableCell><span className="rounded px-2 py-0.5 bg-rose-50 text-rose-700">{item.late_minutes ? `${item.late_minutes}m` : '-'}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
