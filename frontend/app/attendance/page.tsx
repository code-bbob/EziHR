'use client';

import { useEffect, Suspense, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApi } from '@/lib/hooks/useApi';
import { apiClient, type DashboardData } from '@/lib/api-client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';

// shadcn UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AttendanceReportTabs } from '@/components/attendance-report-tabs';
import { Loader } from 'lucide-react';

type AttendanceRow = DashboardData['attendance_rows'][number];

type AttendanceRowsResponse = {
  attendance_rows: AttendanceRow[];
  attendance_date: string;
  count: number;
  pagination?: {
    next?: string | null;
    previous?: string | null;
    page?: number;
    page_size?: number;
  };
};

type BreakSession = {
  break_out?: string | null;
  break_in?: string | null;
};

const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

const getBreakSessions = (row: AttendanceRow): BreakSession[] => {
  if (Array.isArray(row.break_sessions) && row.break_sessions.length > 0) {
    return row.break_sessions;
  }
  return [];
};

const applyBreakEventToSessions = (
  sessions: BreakSession[] | undefined,
  eventType: number,
  eventTime: string
): BreakSession[] => {
  const nextSessions = Array.isArray(sessions) ? [...sessions] : [];
  const hasBreakOutAtTime = nextSessions.some((session) => session.break_out === eventTime);
  const hasBreakInAtTime = nextSessions.some((session) => session.break_in === eventTime);

  if (eventType === 2) {
    // SSE may deliver the same event more than once; ignore duplicates.
    if (hasBreakOutAtTime) {
      return nextSessions;
    }
    const lastSession = nextSessions[nextSessions.length - 1];
    if (!lastSession || lastSession.break_in) {
      nextSessions.push({ break_out: eventTime, break_in: null });
    } else {
      lastSession.break_out = eventTime;
    }
  }

  if (eventType === 3) {
    // SSE may deliver the same event more than once; ignore duplicates.
    if (hasBreakInAtTime) {
      return nextSessions;
    }
    const lastSession = nextSessions[nextSessions.length - 1];
    if (lastSession && !lastSession.break_in) {
      lastSession.break_in = eventTime;
    } else {
      nextSessions.push({ break_out: null, break_in: eventTime });
    }
  }

  return nextSessions;
};

function AttendanceContent() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const { 
    selectedBranchId, 
    selectedDepartmentId,
    setBranch,
    setDepartment
  } = useFilters();

  const { data, loading } = useApi<DashboardData>(
    () => apiClient.dashboard.getAttendance(selectedBranchId, selectedDepartmentId),
    [selectedBranchId, selectedDepartmentId]
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showAllLoading, setShowAllLoading] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [allAttendanceRows, setAllAttendanceRows] = useState<AttendanceRow[]>([]);
  const seenEventKeysRef = useRef<Set<string>>(new Set());

  const applyEventToRows = (prevRows: AttendanceRow[], payload: any) => {
    if (!payload) return { rows: prevRows, added: false };
    const empId = Number(payload.employee_id);
    if (!empId) return { rows: prevRows, added: false };
    const eventType = Number(payload.event_type);
    const eventTime = payload.event_time;
    const authoritativeFirstCheckIn = payload.first_check_in ?? null;
    const authoritativeLastCheckOut = payload.last_check_out ?? null;
    const authoritativeWorkedMinutes =
      typeof payload.worked_minutes !== 'undefined' ? Number(payload.worked_minutes) : null;

    const next = [...prevRows];
    let found = false;

    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      if (row.employee && row.employee.id === empId) {
        found = true;
        row.present = true;
        if (authoritativeFirstCheckIn) {
          row.check_in = authoritativeFirstCheckIn;
        } else if (eventType === 0) {
          row.check_in = eventTime;
        }

        if (authoritativeLastCheckOut) {
          row.check_out = authoritativeLastCheckOut;
        } else if (eventType === 1) {
          row.check_out = eventTime;
        }

        if (authoritativeWorkedMinutes !== null) {
          row.worked_minutes = authoritativeWorkedMinutes;
        }

        if (eventType === 2 || eventType === 3) {
          row.break_sessions = applyBreakEventToSessions(row.break_sessions, eventType, eventTime);
        }
        if (eventType === 2) row.break_out = eventTime;
        if (eventType === 3) row.break_in = eventTime;
        if (eventType === 4) row.ot_in = eventTime;
        if (eventType === 5) row.ot_out = eventTime;
        break;
      }
    }

    if (!found) {
      next.unshift({
        employee: {
          id: empId,
          employee_code: String(payload.employee_code || empId),
          name: payload.employee_name || 'Unknown',
        },
        present: true,
        check_in: eventType === 0 ? eventTime : null,
        check_out: eventType === 1 ? eventTime : null,
        break_sessions:
          eventType === 2
            ? [{ break_out: eventTime, break_in: null }]
            : eventType === 3
              ? [{ break_out: null, break_in: eventTime }]
              : [],
        break_out: eventType === 2 ? eventTime : null,
        break_in: eventType === 3 ? eventTime : null,
        ot_in: eventType === 4 ? eventTime : null,
        ot_out: eventType === 5 ? eventTime : null,
        worked_minutes: authoritativeWorkedMinutes ?? 0,
      } as AttendanceRow);
    }

    return { rows: next, added: !found };
  };

  const searchParams = useSearchParams();
  const branchParam = searchParams.get('branch');
  const deptParam = searchParams.get('department');

  // Sync query params with filters on mount or when params change
  useEffect(() => {
    if (branchParam) setBranch(parseInt(branchParam));
    if (deptParam) setDepartment(parseInt(deptParam));
  }, [branchParam, deptParam, setBranch, setDepartment]);

  useEffect(() => {
    setShowAll(false);
    setAllAttendanceRows([]);
    setCurrentPage(1);
  }, [selectedBranchId, selectedDepartmentId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || showAll) return;

    let cancelled = false;

    const loadRows = async () => {
      try {
        setRowsLoading(true);
        const params = new URLSearchParams();
        if (selectedBranchId) params.append('branch_id', String(selectedBranchId));
        if (selectedDepartmentId) params.append('department_id', String(selectedDepartmentId));
        params.append('page', String(currentPage));

        const queryString = params.toString();
        const response = await apiClient.request<AttendanceRowsResponse>(
          `/attendance/api/attendance/rows/${queryString ? `?${queryString}` : ''}`
        );

        if (cancelled) return;

        setAttendanceRows(Array.isArray(response?.attendance_rows) ? response.attendance_rows : []);
        setTotalCount(typeof response?.count === 'number' ? response.count : (response?.attendance_rows?.length || 0));
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load attendance rows:', err);
        }
      } finally {
        if (!cancelled) setRowsLoading(false);
      }
    };

    loadRows();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, selectedBranchId, selectedDepartmentId, currentPage, showAll]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const url = `${base}/attendance/api/events/stream/`;
    let es: EventSource | null = null;

    try {
      es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const eventId = payload?.event_id;
          const fallbackKey = `${payload?.employee_id ?? 'x'}:${payload?.event_type ?? 'x'}:${payload?.event_time ?? 'x'}`;
          const eventKey = eventId ? `id:${String(eventId)}` : `sig:${fallbackKey}`;

          if (seenEventKeysRef.current.has(eventKey)) {
            return;
          }
          seenEventKeysRef.current.add(eventKey);
          if (seenEventKeysRef.current.size > 500) {
            const keys = Array.from(seenEventKeysRef.current);
            seenEventKeysRef.current = new Set(keys.slice(keys.length - 250));
          }

          setAttendanceRows((prev) => {
            const { rows, added } = applyEventToRows(prev, payload);
            if (added) setTotalCount((count) => count + 1);
            return rows;
          });

          if (showAll) {
            setAllAttendanceRows((prev) => applyEventToRows(prev, payload).rows);
          }
        } catch (err) {
          // ignore malformed events
        }
      };
      es.onerror = () => {
        // ignore SSE errors; API polling still works
      };
    } catch (err) {
      // SSE initialization failed; API polling still works
    }

    return () => {
      if (es) es.close();
    };
  }, [isAuthenticated, showAll]);

  const handleShowAll = async () => {
    try {
      setShowAllLoading(true);
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branch_id', String(selectedBranchId));
      if (selectedDepartmentId) params.append('department_id', String(selectedDepartmentId));

      const baseQuery = params.toString();
      let page = 1;
      const results: AttendanceRow[] = [];

      while (true) {
        const pageParams = new URLSearchParams(baseQuery);
        pageParams.append('page', String(page));
        const queryString = pageParams.toString();
        const response = await apiClient.request<AttendanceRowsResponse>(
          `/attendance/api/attendance/rows/${queryString ? `?${queryString}` : ''}`
        );

        const pageRows = Array.isArray(response?.attendance_rows) ? response.attendance_rows : [];
        results.push(...pageRows);

        if (pageRows.length === 0 || !response?.pagination?.next) {
          break;
        }

        page += 1;
      }

      setAllAttendanceRows(results);
      setShowAll(true);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to load all attendance records:', err);
    } finally {
      setShowAllLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto space-y-8">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const rowsSource = showAll ? allAttendanceRows : attendanceRows;
  const itemsPerPage = 30;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const displayStart = showAll ? (rowsSource.length ? 1 : 0) : (totalCount ? startIndex + 1 : 0);
  const displayEnd = showAll ? Math.min(rowsSource.length, endIndex) : Math.min(startIndex + rowsSource.length, totalCount || rowsSource.length);

  const tableRows = rowsSource;

  return (
      <div className="flex-1 w-full">
        {/* <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h2 className="text-sm font-semibold">Daily Attendance Roll</h2>
              <p className="text-xs text-muted-foreground">Complete attendance records</p>
            </div>
          </div>
        </header> */}


        <div className="flex-1 py-4 px-4 sm:px-6 lg:px-8 w-full space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-start gap-3">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">Daily Attendance Roll</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>Complete attendance records for {data?.attendance_date}</span>
                    <AttendanceReportTabs />
                  </div>
                </div>
              </div>
            </div>

          </div>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Attendance Records</CardTitle>
                <CardDescription>All staff attendance for {data?.attendance_date}</CardDescription>
              </div>
              <Button 
                onClick={handleShowAll}
                disabled={showAllLoading || showAll}
                variant={showAll ? "secondary" : "outline"}
                className="rounded-2xl gap-2"
              >
                {showAllLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Loading all...
                  </>
                ) : showAll ? (
                  'Showing all'
                ) : (
                  'Show all'
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>S.N.</TableHead>
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                         <TableHead>Break Out</TableHead>
                         <TableHead>Break In</TableHead>
                        <TableHead>Hours Worked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                            {rowsLoading ? 'Loading attendance rows...' : 'No attendance records found'}
                          </TableCell>
                        </TableRow>
                      ) : tableRows.map((row, idx) => (
                        <TableRow key={row.employee?.id || idx}>
                          <TableCell>{displayStart + idx}</TableCell>
                          <TableCell className="font-medium">
                            <Button
                              variant="link"
                              className="h-auto px-0"
                              onClick={() => {
                                if (row.employee?.id) {
                                  router.push(`/staff/${row.employee.id}`);
                                }
                              }}
                              disabled={!row.employee?.id}
                            >
                              {row.employee?.name || 'Unknown'}
                            </Button>
                          </TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                row.present
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                              }`}
                            >
                              {row.present ? 'Present' : 'Absent'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {formatTime(row.check_in)}
                          </TableCell>
                          <TableCell>
                            {formatTime(row.check_out)}
                          </TableCell>
                          <TableCell>
                            {getBreakSessions(row).length > 0 ? (
                              <div className="space-y-1">
                                {getBreakSessions(row).map((session, sessionIndex) => (
                                  <div key={`${row.employee?.id || idx}-break-out-${sessionIndex}`}>
                                    {formatTime(session.break_out)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {getBreakSessions(row).length > 0 ? (
                              <div className="space-y-1">
                                {getBreakSessions(row).map((session, sessionIndex) => (
                                  <div key={`${row.employee?.id || idx}-break-in-${sessionIndex}`}>
                                    {formatTime(session.break_in)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                            <TableCell>{((row.worked_minutes || 0) / 60).toFixed(2)} hrs</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
                  <div className="text-sm text-muted-foreground">
                    {showAll ? (
                      <>Showing all {rowsSource.length} records</>
                    ) : (
                      <>
                        Showing {displayStart}–{displayEnd} of {totalCount} records
                      </>
                    )}
                  </div>
                  
                  {!showAll && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="rounded-full"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">
                          Page {currentPage} of {totalPages}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="rounded-full"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto space-y-8">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96" />
      </div>
    }>
      <AttendanceContent />
    </Suspense>
  );
}
