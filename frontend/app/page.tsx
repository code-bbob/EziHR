'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApi } from '@/lib/hooks/useApi';
import { apiClient, type DashboardData, type HierarchicalDashboardData, type BranchDashboardData, type DepartmentDashboardData, type LateArrivalItem, type EarlyDepartureItem } from '@/lib/api-client';
import { useAuth } from '@/lib/hooks/useAuth';
import { AddEmployeeModal } from '@/components/AddEmployeeModal';
import { AddDepartmentModal } from '@/components/AddDepartmentModal';
import { useFilters } from '@/hooks/useFilters';
import { useRightSidebar } from '@/hooks/useRightSidebar';
import { getDateFormatPreference } from '@/hooks/use-date-format';

// shadcn UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SidebarTrigger } from '@/components/ui/sidebar';

// Recharts for Data Visualization
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as ChartTooltip, Cell, PieChart, Pie } from 'recharts';
import { Users, UserCheck, UserX, Clock, Download, Plus, Briefcase, ChevronRight, PanelRightIcon } from 'lucide-react';

type ViewLevel = 'enterprise' | 'branch' | 'department';
type HierarchicalViewData = HierarchicalDashboardData | BranchDashboardData | DepartmentDashboardData | null;

export default function HomePage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [dateFormat] = useState(() => getDateFormatPreference());
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const { isOpen: isRightSidebarOpen, toggle: toggleRightSidebar } = useRightSidebar();
  
  // Hierarchical dashboard state
  const { 
    selectedBranchId: hierarchicalSelectedBranchId, 
    selectedDepartmentId: hierarchicalSelectedDepartmentId,
    setBranch,
    setDepartment,
    clearFilters
  } = useFilters();
  
  const [hierarchicalViewLevel, setHierarchicalViewLevel] = useState<ViewLevel>('enterprise');
  const [hierarchicalViewData, setHierarchicalViewData] = useState<HierarchicalViewData>(null);
  const [hierarchicalLoading, setHierarchicalLoading] = useState(false);
  const [hierarchicalError, setHierarchicalError] = useState<string | null>(null);

  const [lateArrivals, setLateArrivals] = useState<LateArrivalItem[]>([]);
  const [earlyDepartures, setEarlyDepartures] = useState<EarlyDepartureItem[]>([]);
  const [lateEarlyLoading, setLateEarlyLoading] = useState(false);

  const isNotFoundError = (value: unknown) => {
    const message = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
    return /not found|404|does not exist/i.test(message);
  };
  
  const { data, loading, error, refetch } = useApi<DashboardData>(
    () => apiClient.dashboard.getAttendance(undefined, undefined, dateFormat)
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const [localData, setLocalData] = useState<DashboardData | null>(null);

  // keep localData in sync with server responses
  useEffect(() => {
    if (data) setLocalData(data);
  }, [data]);

  // Subscribe to backend SSE events and apply lightweight deltas to localData
  useEffect(() => {
    if (!isAuthenticated) return;
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const url = `${base}/attendance/api/events/stream/`;
    let es: EventSource | null = null;

    const applyEventToData = (prev: DashboardData | null, payload: any): DashboardData | null => {
      if (!prev || !payload) return prev;
      try {
        const next = JSON.parse(JSON.stringify(prev)) as DashboardData;
        const empId = Number(payload.employee_id);
        const eventType = Number(payload.event_type);
        const eventTime = payload.event_time;
        const authoritativeFirstCheckIn = payload.first_check_in ?? null;
        const authoritativeLastCheckOut = payload.last_check_out ?? null;
        const authoritativeWorkedMinutes = typeof payload.worked_minutes !== 'undefined' ? Number(payload.worked_minutes) : null;

        let found = false;
        next.attendance_rows = next.attendance_rows || [];
        for (let i = 0; i < next.attendance_rows.length; i++) {
          const row = next.attendance_rows[i];
            if (row.employee && row.employee.id === empId) {
            found = true;
            row.present = true;
            // Prefer authoritative summary values from the payload when available.
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

            // If backend provided worked_minutes, use it. Otherwise, on a checkout event try a best-effort compute.
            if (authoritativeWorkedMinutes !== null) {
              row.worked_minutes = authoritativeWorkedMinutes;
              if (!row.summary) row.summary = {} as any;
              const sref = row.summary as any;
              sref.worked_minutes = authoritativeWorkedMinutes;
              sref.worked_hours = +(authoritativeWorkedMinutes / 60).toFixed(2);
            } else if (eventType === 1) {
              try {
                const checkIn = row.check_in ? new Date(row.check_in) : null;
                const checkOut = row.check_out ? new Date(row.check_out) : null;
                if (checkIn && checkOut && !isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())) {
                  const mins = Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000));
                  row.worked_minutes = mins;
                  if (!row.summary) row.summary = {} as any;
                  const sref = row.summary as any;
                  sref.worked_minutes = mins;
                  sref.worked_hours = +(mins / 60).toFixed(2);
                }
              } catch (e) {
                // ignore calculation errors
              }
            }

            if (eventType === 2) row.break_out = eventTime;
            if (eventType === 3) row.break_in = eventTime;
            if (eventType === 4) row.ot_in = eventTime;
            if (eventType === 5) row.ot_out = eventTime;
            if (!row.summary) row.summary = {} as any;
            const summaryRef = row.summary as any;
            summaryRef.last_event_type = eventType;
            summaryRef.last_event_time = eventTime;
            // Keep summary fields in-sync if backend provided them
            if (authoritativeFirstCheckIn) summaryRef.first_check_in = authoritativeFirstCheckIn;
            if (authoritativeLastCheckOut) summaryRef.last_check_out = authoritativeLastCheckOut;
            break;
          }
        }

        if (!found) {
          next.attendance_rows.unshift({
            employee: { id: empId, employee_code: String(empId), name: payload.employee_name, user: { id: 0, username: '', email: '', first_name: '', last_name: '' } },
            present: true,
            check_in: eventType === 0 ? eventTime : null,
            check_out: eventType === 1 ? eventTime : null,
            break_out: eventType === 2 ? eventTime : null,
            break_in: eventType === 3 ? eventTime : null,
            ot_in: eventType === 4 ? eventTime : null,
            ot_out: eventType === 5 ? eventTime : null,
            worked_minutes: 0,
            summary: { id: 0, employee: empId, employee_name: payload.employee_name, employee_code: String(empId), attendance_date: next.attendance_date, worked_minutes: 0, worked_hours: 0, present: true } as any,
          } as any);
        }

        // update simple stats heuristically
        try {
          next.stats = next.stats || ({} as any);
          next.stats.present_today = next.attendance_rows.filter(r => r.present).length;
          next.stats.absent_today = Math.max((next.stats.total_employees || next.attendance_rows.length) - next.stats.present_today, 0);
        } catch (e) {
          // ignore
        }

        return next;
      } catch (e) {
        return prev;
      }
    };

    try {
      es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          setLocalData((prev) => applyEventToData(prev ?? data ?? null, payload));
        } catch (err) {
          // fallback to refetch if we cannot parse or apply delta
          refetch();
        }
      };
      es.onerror = () => {
        // connection error - continue polling via API
      };
    } catch (err) {
      // SSE initialization failed - continue polling via API
    }

    return () => {
      if (es) es.close();
    };
  }, [isAuthenticated, refetch, data]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const loadLateEarly = async () => {
      try {
        setLateEarlyLoading(true);
        const [late, early] = await Promise.all([
          apiClient.dashboard.getLateArrivals(hierarchicalSelectedBranchId, hierarchicalSelectedDepartmentId, null, dateFormat),
          apiClient.dashboard.getEarlyDepartures(hierarchicalSelectedBranchId, hierarchicalSelectedDepartmentId, null, dateFormat),
        ]);

        if (cancelled) return;
        setLateArrivals(Array.isArray(late?.late_arrivals) ? late.late_arrivals : []);
        setEarlyDepartures(Array.isArray(early?.early_departures) ? early.early_departures : []);
      } catch (err) {
        if (!cancelled) {
          setLateArrivals([]);
          setEarlyDepartures([]);
        }
      } finally {
        if (!cancelled) setLateEarlyLoading(false);
      }
    };

    loadLateEarly();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, dateFormat, hierarchicalSelectedBranchId, hierarchicalSelectedDepartmentId]);

  const handleEmployeeCreated = () => {
    setShowAddEmployeeModal(false);
    refetch();
  };

  const handleDepartmentCreated = () => {
    setShowAddDepartmentModal(false);
    refetch();
  };

  const searchParams = useSearchParams();
  const branchParam = searchParams.get('branch');
  const departmentParam = searchParams.get('department');

  // Sync URL params with filter state
  useEffect(() => {
    if (branchParam && parseInt(branchParam) !== hierarchicalSelectedBranchId) {
      setBranch(parseInt(branchParam));
    }
    if (departmentParam && parseInt(departmentParam) !== hierarchicalSelectedDepartmentId) {
      setDepartment(parseInt(departmentParam));
    }
    // If no params but filter is set, maybe we should clear it? 
    // Or if filter is set but no params, we should push params.
  }, [branchParam, departmentParam, setBranch, setDepartment]);

  useEffect(() => {
    if (hierarchicalSelectedDepartmentId) {
      setHierarchicalViewLevel('department');
    } else if (hierarchicalSelectedBranchId) {
      setHierarchicalViewLevel('branch');
    } else {
      setHierarchicalViewLevel('enterprise');
    }
  }, [hierarchicalSelectedBranchId, hierarchicalSelectedDepartmentId]);

  // Load hierarchical data
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadHierarchicalData = async () => {
      try {
        setHierarchicalLoading(true);
        setHierarchicalError(null);

        if (hierarchicalViewLevel === 'enterprise') {
          const data = await apiClient.dashboard.getHierarchical();
          setHierarchicalViewData(data);
        } else if (hierarchicalViewLevel === 'branch' && hierarchicalSelectedBranchId) {
          const data = await apiClient.dashboard.getBranch(hierarchicalSelectedBranchId);
          setHierarchicalViewData(data);
        } else if (hierarchicalViewLevel === 'department' && hierarchicalSelectedDepartmentId) {
          const data = await apiClient.dashboard.getDepartment(hierarchicalSelectedDepartmentId);
          setHierarchicalViewData(data);
        }
      } catch (err) {
        if (hierarchicalViewLevel === 'department' && hierarchicalSelectedDepartmentId && isNotFoundError(err)) {
          clearFilters();
          setHierarchicalViewLevel('enterprise');
          setHierarchicalViewData(null);
          setHierarchicalError(null);
          return;
        }

        if (hierarchicalViewLevel === 'branch' && hierarchicalSelectedBranchId && isNotFoundError(err)) {
          clearFilters();
          setHierarchicalViewLevel('enterprise');
          setHierarchicalViewData(null);
          setHierarchicalError(null);
          return;
        }

        setHierarchicalError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setHierarchicalLoading(false);
      }
    };

    loadHierarchicalData();
  }, [isAuthenticated, hierarchicalViewLevel, hierarchicalSelectedBranchId, hierarchicalSelectedDepartmentId]);

  const sourceData = localData ?? data;
  const attendanceRows = sourceData?.attendance_rows || [];
  const stats = sourceData?.stats;
  const totalEmployees = stats?.total_employees ?? attendanceRows.length;
  const presentCount = stats?.present_today ?? attendanceRows.filter((row) => row.present).length;
  const absentCount = stats?.absent_today ?? Math.max(totalEmployees - presentCount, 0);
  const avgWorkHours = (stats?.average_worked_hours ?? 0).toFixed(1);

  const recentActivities = useMemo(() => {
    return attendanceRows
      .map((row) => {
        const lastEventTime = row.summary?.last_event_time;
        const lastEventType = row.summary?.last_event_type;
        if (!lastEventTime || typeof lastEventType !== 'number') return null;
        return {
          id: row.employee?.id ?? 0,
          name: row.employee?.name || 'Unknown',
          eventTime: lastEventTime,
          eventType: lastEventType,
        };
      })
      .filter((item): item is { id: number; name: string; eventTime: string; eventType: number } => Boolean(item))
      .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
      .slice(0, 6);
  }, [attendanceRows]);

  const earliestArrivals = useMemo(() => {
    return attendanceRows
      .filter((row) => row.check_in)
      .map((row) => ({
        id: row.employee?.id ?? 0,
        name: row.employee?.name || 'Unknown',
        checkIn: row.check_in as string,
      }))
      .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
      .slice(0, 6);
  }, [attendanceRows]);

  if (authLoading || (loading && !data)) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 space-y-8 max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-12 w-96 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mt-6">
            <Skeleton className="h-96 w-full lg:col-span-4 rounded-xl" />
            <Skeleton className="h-96 w-full lg:col-span-3 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const eventLabel = (type: number) => {
    const labels: Record<number, string> = {
      0: 'Check-in',
      1: 'Check-out',
      2: 'Break out',
      3: 'Break in',
      4: 'OT in',
      5: 'OT out',
    };
    return labels[type] || 'Event';
  };

  const eventColor = (type: number) => {
    const colors: Record<number, string> = {
      0: 'text-emerald-600',
      1: 'text-rose-600',
      2: 'text-amber-600',
      3: 'text-emerald-600',
      4: 'text-indigo-600',
      5: 'text-indigo-600',
    };
    return colors[type] || 'text-muted-foreground';
  };

  if (!isAuthenticated || !user?.is_admin) {
    if (isAuthenticated && !user?.is_admin) {
      router.push('/employee-dashboard');
      return null;
    }
    return null;
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-md border-destructive/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                ⚠️ Connection Error
              </CardTitle>
              <CardDescription>{error.message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg border">
                Make sure the backend API is running on:
                <code className="block text-primary mt-2 font-mono bg-background p-1 px-2 rounded border inline-block">http://localhost:8000</code>
              </div>
              <Button className="w-full" variant="outline" onClick={() => window.location.reload()}>
                Retry Connection
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Data shaping for Recharts
  const pieData = [
    { name: 'Present', value: presentCount, color: '#10b981' }, // emerald-500
    { name: 'Absent', value: absentCount, color: '#f43f5e' },   // rose-500
  ];

  // Top workers bar chart data
  const topWorkers = [...attendanceRows]
    .filter(r => r.present)
    .sort((a, b) => b.worked_minutes - a.worked_minutes)
    .slice(0, 5)
    .map(r => ({
      name: r.employee?.name?.split(' ')[0] || 'Unknown',
      hours: Number((r.worked_minutes / 60).toFixed(1))
    }));
  

  return (
    <div className="flex-1 py-4 px-4 sm:px-6 lg:px-8 w-full space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-start gap-3">
                
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Attendance management and analytics for {sourceData?.attendance_date ?? data?.attendance_date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddDepartmentModal(true)}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
                <Button size="sm" onClick={() => setShowAddEmployeeModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-4 bg-transparent border-b rounded-none w-full justify-start h-auto p-0 space-x-6">
                <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 shadow-none">
                  Analytics Overview
                </TabsTrigger>
                <TabsTrigger value="future" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 py-3 shadow-none">
                  Future Tabs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPI title="Total Workforce" value={totalEmployees} icon={<Users className="h-4 w-4 text-muted-foreground" />} trend="Enterprise-wide" />
                  <KPI title="Present Today" value={presentCount} icon={<UserCheck className="h-4 w-4 text-emerald-500" />} trend={`${((presentCount / (totalEmployees || 1)) * 100).toFixed(0)}% attendance rate`} />
                  <KPI title="Absent Today" value={absentCount} icon={<UserX className="h-4 w-4 text-rose-500" />} trend={absentCount === 0 ? 'Perfect attendance!' : 'Requires attention'} />
                  <KPI title="Avg Daily Hours" value={`${avgWorkHours}h`} icon={<Clock className="h-4 w-4 text-blue-500" />} trend="Across all active staff" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div>
                        <CardTitle>Late Arrivals</CardTitle>
                        <CardDescription>Checked in after the scheduled time</CardDescription>
                      </div>
                      <Badge variant="outline">Today</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {lateEarlyLoading ? (
                        <p className="text-sm text-muted-foreground">Loading late arrivals...</p>
                      ) : lateArrivals.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No late arrivals today.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Sched</TableHead>
                                <TableHead>Check-In</TableHead>
                                <TableHead className="text-right">Late</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lateArrivals.slice(0, 5).map((item, idx) => (
                                <TableRow key={`${item.employee?.id}-${idx}`}>
                                  <TableCell className="font-medium">{item.employee?.name || 'Unknown'}</TableCell>
                                  <TableCell>
                                    {new Date(item.scheduled_arrival).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                  <TableCell className='text-red-600'>
                                    {new Date(item.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                  <TableCell className="text-right text-rose-600 font-medium">
                                    {item.late_minutes.toFixed(1)}m
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/attendance/reports/late-arrivals')}
                      >
                        View Late Arrivals Report
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div>
                        <CardTitle>Early Departures</CardTitle>
                        <CardDescription>Checked out before the scheduled time</CardDescription>
                      </div>
                      <Badge variant="outline">Today</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {lateEarlyLoading ? (
                        <p className="text-sm text-muted-foreground">Loading early departures...</p>
                      ) : earlyDepartures.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No early departures today.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Out</TableHead>
                                <TableHead>Sched</TableHead>
                                <TableHead className="text-right">Early</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {earlyDepartures.slice(0, 5).map((item, idx) => (
                                <TableRow key={`${item.employee?.id}-${idx}`}>
                                  <TableCell className="font-medium">{item.employee?.name || 'Unknown'}</TableCell>
                                  <TableCell>
                                    {new Date(item.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                  <TableCell>
                                    {new Date(item.scheduled_departure).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                  <TableCell className="text-right text-rose-600 font-medium">
                                    {item.early_minutes.toFixed(1)}m
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/attendance/reports/early-departures')}
                      >
                        View Early Departures Report
                      </Button>
                    </CardContent>
                  </Card>

                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div>
                        <CardTitle>Recent Activities</CardTitle>
                        <CardDescription>Latest check-ins, check-outs, and breaks</CardDescription>
                      </div>
                      <Badge variant="outline">Live</Badge>
                    </CardHeader>
                    <CardContent>
                      {recentActivities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No recent activity yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Event</TableHead>
                                <TableHead className="text-right">Time</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {recentActivities.map((item, idx) => (
                                <TableRow key={`${item.id}-${idx}`}>
                                  <TableCell className="font-medium">{item.name}</TableCell>
                                  <TableCell className={eventColor(item.eventType)}>{eventLabel(item.eventType)}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {new Date(item.eventTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div>
                        <CardTitle>Arrivals Leaderboard</CardTitle>
                        <CardDescription>Top check-ins by time</CardDescription>
                      </div>
                      <Badge variant="outline">Leaderboard</Badge>
                    </CardHeader>
                    <CardContent>
                      {earliestArrivals.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No check-ins yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Check-in</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {earliestArrivals.map((item, idx) => (
                                <TableRow key={`${item.id}-${idx}`}>
                                  <TableCell className="font-medium">{item.name}</TableCell>
                                  <TableCell className="text-right text-emerald-600 font-medium">
                                    {new Date(item.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
{/* 

                <Card className="shadow-sm border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle>Organization View</CardTitle>
                      <CardDescription>Enterprise overview, branch summaries, and quick department drill-ins.</CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground rounded-full bg-muted px-3 py-1">Click cards to drill down</div>
                  </CardHeader>
                  <CardContent>
                    {hierarchicalLoading && (
                      <div className="space-y-4">
                        <Skeleton className="h-10 w-96" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-lg" />
                          ))}
                        </div>
                      </div>
                    )}

                    {!hierarchicalLoading && hierarchicalError && (
                      <Card className="border-destructive/20">
                        <CardHeader>
                          <CardTitle className="text-destructive">Organization View Unavailable</CardTitle>
                          <CardDescription>{hierarchicalError}</CardDescription>
                        </CardHeader>
                      </Card>
                    )}

                    {!hierarchicalLoading && !hierarchicalError && hierarchicalViewData && (
                      <div className="space-y-6">
                        {hierarchicalViewLevel === 'enterprise' && (hierarchicalViewData as HierarchicalDashboardData)?.enterprise && (
                          <HierarchyEnterpriseView
                            enterprise={(hierarchicalViewData as HierarchicalDashboardData).enterprise}
                            onSelectBranch={(branchId: number) => {
                              setBranch(branchId);
                              setHierarchicalViewLevel('branch');
                            }}
                            onSelectDepartment={(deptId: number) => {
                              setDepartment(deptId);
                              setHierarchicalViewLevel('department');
                            }}
                          />
                        )}

                        {hierarchicalViewLevel === 'branch' && (hierarchicalViewData as BranchDashboardData)?.branch && (
                          <HierarchyBranchView
                            branch={(hierarchicalViewData as BranchDashboardData).branch}
                            onSelectDepartment={(deptId: number) => {
                              setDepartment(deptId);
                              setHierarchicalViewLevel('department');
                            }}
                          />
                        )}

                        {hierarchicalViewLevel === 'department' && (hierarchicalViewData as DepartmentDashboardData)?.department && (
                          <HierarchyDepartmentView department={(hierarchicalViewData as DepartmentDashboardData).department} />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card> */}

                <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                  <Card className="lg:col-span-4 shadow-sm border-border/50">
                    <CardHeader>
                      <CardTitle>Top Contributions</CardTitle>
                      <CardDescription>Highest active hours worked today</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                      <div className="h-[300px] w-full">
                        {topWorkers.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topWorkers} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} />
                              <ChartTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Bar dataKey="hours" radius={[4, 4, 0, 0]} barSize={40}>
                                {topWorkers.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill="#3b82f6" />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No active work hours recorded yet.</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-3 shadow-sm border-border/50">
                    <CardHeader>
                      <CardTitle>Workforce Status</CardTitle>
                      <CardDescription>Present vs Absent ratio</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                              ))}
                            </Pie>
                            <ChartTooltip formatter={(value) => [`${value} Employees`, 'Count']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                          <span className="text-muted-foreground">Present ({presentCount})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                          <span className="text-muted-foreground">Absent ({absentCount})</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="future" className="space-y-4">
                <Card className="shadow-sm border-border/50 border-dashed">
                  <CardHeader>
                    <CardTitle>Placeholder Tabs</CardTitle>
                    <CardDescription>These are in place for future dashboard modules.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {['Insights', 'Reports', 'Compliance', 'Trends'].map((label) => (
                      <span key={label} className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground">{label}</span>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

      <AddEmployeeModal isOpen={showAddEmployeeModal} onClose={() => setShowAddEmployeeModal(false)} onSuccess={handleEmployeeCreated} />
      <AddDepartmentModal isOpen={showAddDepartmentModal} onClose={() => setShowAddDepartmentModal(false)} onSuccess={handleDepartmentCreated} />
    </div>
  );
}

function KPI({ title, value, icon, trend }: { title: string, value: string | number, icon: React.ReactNode, trend?: string }) {
  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1 font-medium">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}

function HierarchyEnterpriseView({ enterprise, onSelectBranch, onSelectDepartment }: { enterprise: any; onSelectBranch: (branchId: number) => void; onSelectDepartment: (deptId: number) => void }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">{enterprise.name}</h2>

      {/* Branches Grid */}
      {enterprise.branches && enterprise.branches.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Branches</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enterprise.branches.map((branch: any) => (
              <Card
                key={branch.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => onSelectBranch(branch.id)}
              >
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {branch.name}
                    <ChevronRight className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employees:</span>
                    <span className="font-semibold">{branch.stats?.total_employees || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Present:</span>
                    <Badge variant="outline" className="bg-emerald-50">
                      {branch.stats?.present_today || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Hours:</span>
                    <span className="font-semibold">{(branch.stats?.average_worked_hours || 0).toFixed(1)}h</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Root Departments */}
      {enterprise.departments && enterprise.departments.filter((d: any) => !d.branch_id).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Departments (No Branch)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enterprise.departments.filter((d: any) => !d.branch_id).map((dept: any) => (
              <Card
                key={dept.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => onSelectDepartment(dept.id)}
              >
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {dept.name}
                    <ChevronRight className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employees:</span>
                    <span className="font-semibold">{dept.stats?.total_employees || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Present:</span>
                    <Badge variant="outline" className="bg-emerald-50">
                      {dept.stats?.present_today || 0}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HierarchyBranchView({ branch, onSelectDepartment }: { branch: any; onSelectDepartment: (deptId: number) => void }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">{branch.name}</h2>

      {/* Departments in Branch */}
      {branch.departments && branch.departments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Departments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branch.departments.map((dept: any) => (
              <Card
                key={dept.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => onSelectDepartment(dept.id)}
              >
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {dept.name}
                    <ChevronRight className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employees:</span>
                    <span className="font-semibold">{dept.stats?.total_employees || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Present:</span>
                    <Badge variant="outline" className="bg-emerald-50">
                      {dept.stats?.present_today || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Hours:</span>
                    <span className="font-semibold">{(dept.stats?.average_worked_hours || 0).toFixed(1)}h</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {branch.attendance_rows && (
        <div>
          <h3 className="text-lg font-semibold mb-4">All Employees</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50 border-y">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[250px] pl-6 font-medium">Employee</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium hidden md:table-cell">First In</TableHead>
                    <TableHead className="font-medium hidden md:table-cell">Last Out</TableHead>
                    <TableHead className="text-right pr-6 font-medium">Logged Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branch.attendance_rows.map((row: any) => (
                    <TableRow key={row.employee.id}>
                      <TableCell className="pl-6">
                        <div className="font-medium">{row.employee.name}</div>
                        <div className="text-xs text-muted-foreground">{row.employee.employee_code}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={row.present ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>
                          {row.present ? 'Present' : 'Absent'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {row.check_in ? new Date(row.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {row.check_out ? new Date(row.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-mono text-sm">{(row.worked_minutes / 60).toFixed(1)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function HierarchyDepartmentView({ department }: { department: any }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">{department.name}</h2>

      {department.attendance_rows && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Employee Attendance</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50 border-y">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[250px] pl-6 font-medium">Employee</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium hidden md:table-cell">First In</TableHead>
                    <TableHead className="font-medium hidden md:table-cell">Last Out</TableHead>
                    <TableHead className="text-right pr-6 font-medium">Logged Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {department.attendance_rows.map((row: any) => (
                    <TableRow key={row.employee.id}>
                      <TableCell className="pl-6">
                        <div className="font-medium">{row.employee.name}</div>
                        <div className="text-xs text-muted-foreground">{row.employee.employee_code}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={row.present ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>
                          {row.present ? 'Present' : 'Absent'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {row.check_in ? new Date(row.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {row.check_out ? new Date(row.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-mono text-sm">{(row.worked_minutes / 60).toFixed(1)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
