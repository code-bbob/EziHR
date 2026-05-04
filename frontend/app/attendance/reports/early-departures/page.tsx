"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useFilters } from '@/hooks/useFilters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceReportTabs } from '@/components/attendance-report-tabs';

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function EarlyDeparturesReport() {
  const { selectedBranchId, selectedDepartmentId } = useFilters();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(getToday());

  const reportLabel = useMemo(() => {
    const date = new Date(`${attendanceDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return attendanceDate;

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }, [attendanceDate]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.dashboard.getEarlyDepartures(selectedBranchId, selectedDepartmentId, attendanceDate);
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
          <h1 className="text-3xl font-bold tracking-tight">Early Departures Report</h1>
          <p className="text-sm text-muted-foreground">Generated for: {reportLabel}</p>

          <AttendanceReportTabs />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <label className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Attendance Date</label>
            <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="w-full sm:w-[180px]" />
          </div>
          <Button onClick={loadReport} className="sm:shrink-0">Apply</Button>
        </div>
      </header>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Early Departures</CardTitle>
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
          ) : (!data || !data.early_departures || !data.early_departures.length) ? (
            <div className="p-6 text-sm text-muted-foreground">No early departures for the selected date/filters.</div>
          ) : (
            <div className="overflow-x-auto px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.N.</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Actual Time</TableHead>
                    <TableHead>Left Early</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.early_departures.map((item: any, idx: number) => (
                    <TableRow key={item.employee?.id || idx}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>{item.employee?.name || item.employee?.employee_name || 'Unknown'}</TableCell>
                      <TableCell>{item.scheduled_departure ? new Date(item.scheduled_departure).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</TableCell>
                      <TableCell className="text-amber-600">{item.check_out ? new Date(item.check_out).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</TableCell>
                      <TableCell><span className="rounded px-2 py-0.5 bg-amber-50 text-amber-700">{item.early_minutes ? `${item.early_minutes}m` : '-'}</span></TableCell>
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
