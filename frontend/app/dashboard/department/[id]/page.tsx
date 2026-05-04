'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useApi } from '@/lib/hooks/useApi';
import { apiClient, type DepartmentDashboardData } from '@/lib/api-client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import { Navbar } from '@/components/Navbar';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { SidebarRight } from '@/components/sidebar-right';

// shadcn UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

// Recharts for Data Visualization
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as ChartTooltip, Cell, PieChart, Pie } from 'recharts';
import { Users, UserCheck, UserX, Clock, ChevronLeft } from 'lucide-react';

export default function DepartmentDetailPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const deptId = params.id as string;
  const { setBranch, setDepartment, clearFilters, clearDepartment, selectedBranchId, selectedDepartmentId } = useFilters();

  // Department data state
  const [departmentData, setDepartmentData] = useState<DepartmentDashboardData | null>(null);

  useEffect(() => {
    if (deptId && departmentData?.branch?.id) {
      setBranch(departmentData.branch.id);
      setDepartment(parseInt(deptId));
      router.replace(`/?branch=${departmentData.branch.id}&department=${deptId}`);
    }
  }, [deptId, departmentData, setBranch, setDepartment, router]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch department data
  useEffect(() => {
    const fetchDepartmentData = async () => {
      if (!deptId) return;
      try {
        setLoading(true);
        const response = await apiClient.dashboard.getDepartment(parseInt(deptId));
        setDepartmentData(response);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch department data');
        console.error('Error fetching department data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartmentData();
  }, [deptId]);

  if (loading) {
    return (
      <SidebarProvider>
        <SidebarInset className="lg:pr-[24rem]">
          <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background">
            <div className="flex flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
            </div>
          </header>
          <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto space-y-8">
            <Skeleton className="h-12 w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (error || !departmentData) {
    return (
      <SidebarProvider>
        <SidebarInset className="lg:pr-[24rem]">
          <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background">
            <div className="flex flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
            </div>
          </header>
          <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto space-y-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-500">Error</h1>
              <p className="text-muted-foreground mt-2">{error || 'Department not found'}</p>
              <Button onClick={() => router.back()} className="mt-4">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  const totalEmployees = departmentData.department?.stats?.total_employees || 0;
  const presentCount = departmentData.department?.stats?.present_today || 0;
  const absentCount = totalEmployees - presentCount;
  const avgWorkHours = (departmentData.department?.stats?.average_worked_hours || 0).toFixed(1);

  const attendanceRows = departmentData.department?.attendance_rows || [];
  const departmentName = departmentData.department?.name || 'Department';

  return (
    <SidebarProvider>
      <DashboardSidebar
        enterpriseName={departmentData.enterprise?.name || 'Enterprise'}
        selectedBranchId={departmentData.branch?.id || null}
        selectedBranchName={departmentData.branch?.name}
        selectedDepartmentId={parseInt(deptId)}
        selectedDepartmentName={departmentName}
        attendanceDate={departmentData?.attendance_date ?? null}
        totalEmployees={totalEmployees}
        presentCount={presentCount}
        absentCount={absentCount}
        currentLevel="department"
        branches={departmentData.enterprise?.branches || []}
        departments={(departmentData.branch?.departments || []).map(dept => ({
          ...dept,
          branch_id: dept.branch_id || undefined,
        }))}
        employees={attendanceRows.map(row => ({
          id: row.employee?.id || 0,
          name: row.employee?.name || 'Unknown',
          employee_code: row.employee?.employee_code,
          stats: {
            present: row.present,
            check_in: row.check_in,
            check_out: row.check_out,
          }
        }))}
        onGoEnterprise={() => {
          clearFilters();
          router.push('/');
        }}
        onClearBranch={() => {
          clearFilters();
          router.push('/');
        }}
        onClearDepartment={() => {
          clearDepartment();
          if (departmentData.branch?.id) {
            router.push(`/dashboard/branch/${departmentData.branch.id}`);
          } else {
            router.push('/');
          }
        }}
        onSelectBranch={(id) => {
          setBranch(id);
          router.push(`/dashboard/branch/${id}`);
        }}
        onSelectDepartment={(id) => {
          setDepartment(id);
          router.push(`/dashboard/department/${id}`);
        }}
        onViewAttendance={() => {
          const params = new URLSearchParams();
          if (selectedBranchId) params.set('branch', selectedBranchId.toString());
          if (selectedDepartmentId) params.set('department', selectedDepartmentId.toString());
          const queryString = params.toString();
          router.push(`/attendance${queryString ? `?${queryString}` : ''}`);
        }}
        onViewDashboard={() => {
          if (selectedDepartmentId) {
            router.push(`/dashboard/department/${selectedDepartmentId}`);
          } else if (selectedBranchId) {
            router.push(`/dashboard/branch/${selectedBranchId}`);
          } else {
            router.push('/');
          }
        }}
      />

      <SidebarInset>
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h2 className="text-sm font-semibold">{departmentName}</h2>
              <p className="text-xs text-muted-foreground">Department Details</p>
            </div>
          </div>
        </header>

        <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{departmentName}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Department attendance details for {departmentData?.attendance_date}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEmployees}</div>
                <p className="text-xs text-muted-foreground">In this department</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                <UserCheck className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{presentCount}</div>
                <p className="text-xs text-muted-foreground">{((presentCount / (totalEmployees || 1)) * 100).toFixed(0)}% attendance</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
                <UserX className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{absentCount}</div>
                <p className="text-xs text-muted-foreground">Requires attention</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Hours</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgWorkHours}h</div>
                <p className="text-xs text-muted-foreground">Per employee</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>Department staff attendance for {departmentData?.attendance_date}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Hours Worked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRows.map((row) => (
                      <TableRow key={row.employee?.id}>
                        <TableCell className="font-medium">{row.employee?.name || 'Unknown'}</TableCell>
                        <TableCell>{row.employee?.employee_code || '-'}</TableCell>
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
                          {row.check_in
                            ? new Date(row.check_in).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {row.check_out
                            ? new Date(row.check_out).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>{((row.worked_minutes || 0) / 60).toFixed(2)} hrs</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
      <SidebarRight />
    </SidebarProvider>
  );
}
