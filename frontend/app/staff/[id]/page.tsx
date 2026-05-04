'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Building2, Users, Briefcase, Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiClient, type EnterpriseHierarchyItem } from '@/lib/api-client';

interface EmployeeDetail {
  id: number;
  name: string;
  employee_code: string;
  email: string;
  phone_number?: string;
  address?: string;
  date_of_birth?: string;
  department?: {
    id: number;
    name: string;
  };
  branch?: {
    id: number;
    name: string;
  };
  enterprise?: {
    id: number;
    name: string;
  };
  is_active: boolean;
  user?: {
    is_superuser?: boolean;
    is_staff?: boolean;
  };
}

interface AttendanceDayReport {
  attendance_date: string;
  present?: boolean;
  first_check_in?: string | null;
  last_check_out?: string | null;
  late_seconds?: number;
  early_seconds?: number;
  worked_hours?: number;
}

interface MonthlyAttendanceReport {
  rows?: Array<{ employee?: { id: number; name: string; employee_code: string }; days?: AttendanceDayReport[] }>;
}

function getCurrentMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function formatDateLabel(value?: string | null) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeLabel(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function secondsToMinutesLabel(seconds?: number | null) {
  const value = Number(seconds || 0);
  if (!value) return '-';
  return `${(value / 60).toFixed(1)} min`;
}

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffId = Number(params.id);
  const monthBounds = useMemo(() => getCurrentMonthBounds(), []);
  const editRequested = searchParams.get('edit') === '1';

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [attendanceReport, setAttendanceReport] = useState<MonthlyAttendanceReport | null>(null);
  const [hierarchy, setHierarchy] = useState<EnterpriseHierarchyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(editRequested);
  const [error, setError] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reportStartDate, setReportStartDate] = useState(monthBounds.startDate);
  const [reportEndDate, setReportEndDate] = useState(monthBounds.endDate);
  const [editForm, setEditForm] = useState({
    name: '',
    employee_code: '',
    branchId: '',
    departmentId: '',
    is_active: true,
  });

  const employeeDays = attendanceReport?.rows?.[0]?.days || [];
  const presentDays = employeeDays.filter((day) => Boolean(day?.present)).length;
  const absentDays = employeeDays.length - presentDays;
  const lateDays = employeeDays.filter((day) => Number(day?.late_seconds || 0) > 0).length;
  const earlyDays = employeeDays.filter((day) => Number(day?.early_seconds || 0) > 0).length;
  const workedHours = employeeDays.reduce((sum, day) => sum + Number(day?.worked_hours || 0), 0).toFixed(2);

  const enterprise = hierarchy[0] || null;
  const branchOptions = enterprise?.branches || [];
  const departmentOptions = useMemo(() => {
    if (!editForm.branchId) return enterprise?.departments || [];
    const branchId = Number(editForm.branchId);
    return (enterprise?.departments || []).filter((department) => !department.branch || department.branch.id === branchId);
  }, [editForm.branchId, enterprise]);

  useEffect(() => {
    const loadHierarchy = async () => {
      try {
        const response = await apiClient.enterprise.hierarchy();
        setHierarchy(response.enterprises || []);
      } catch {
        setHierarchy([]);
      }
    };

    loadHierarchy();
  }, []);

  useEffect(() => {
    if (!employee) return;

    setEditForm({
      name: employee.name || '',
      employee_code: employee.employee_code || '',
      branchId: employee.branch?.id ? String(employee.branch.id) : '',
      departmentId: employee.department?.id ? String(employee.department.id) : '',
      is_active: employee.is_active,
    });
  }, [employee]);

  useEffect(() => {
    if (editRequested) {
      setIsEditing(true);
    }
  }, [editRequested]);

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    setAttendanceError(null);

    try {
      const response = await apiClient.dashboard.getMonthlySummaryDetailed({
        startDate: reportStartDate,
        endDate: reportEndDate,
        employeeId: staffId,
      });
      setAttendanceReport(response as MonthlyAttendanceReport);
    } catch (err) {
      setAttendanceReport(null);
      setAttendanceError(err instanceof Error ? err.message : 'Failed to load attendance report');
    } finally {
      setAttendanceLoading(false);
    }
  }, [reportStartDate, reportEndDate, staffId]);

  useEffect(() => {
    const loadStaffDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load employee details
        const empData = await apiClient.employees.detail(staffId);
        setEmployee(empData);

        await loadAttendance();
      } catch (err) {
        console.error('Error loading staff details:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load staff details';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (staffId) {
      loadStaffDetails();
    }
  }, [staffId, loadAttendance]);

  const applyDateFilter = async () => {
    await loadAttendance();
  };

  const handleSaveEmployee = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const updated = await apiClient.employees.update(staffId, {
        name: editForm.name,
        employee_code: editForm.employee_code,
        branch_id: editForm.branchId || null,
        department_id: editForm.departmentId || null,
        is_active: editForm.is_active,
      });

      setEmployee(updated);
      setIsEditing(false);
      router.replace(`/staff/${staffId}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 py-4 px-4 sm:px-6 lg:px-8 w-full space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="flex-1 py-4 px-4 sm:px-6 lg:px-8 w-full space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2 px-0 w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-destructive text-sm font-medium">{error || 'Staff member not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = employee.user?.is_superuser || employee.user?.is_staff;

  return (
    <div className="flex-1 py-4 px-4 sm:px-6 lg:px-8 w-full space-y-4">
      <div className="flex items-center justify-between mb-1">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2 px-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {employee.is_active ? (
            <Badge variant="default" className="bg-green-600/80">Active</Badge>
          ) : (
            <Badge variant="secondary" className="bg-red-600/80 text-white">Inactive</Badge>
          )}
          {isAdmin && (
            <Badge variant="outline">Admin</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditing((value) => !value);
              router.replace(`/staff/${staffId}${isEditing ? '' : '?edit=1'}`);
            }}
          >
            {isEditing ? 'Close edit' : 'Edit profile'}
          </Button>
        </div>
      </div>

      {saveError && (
        <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-destructive">{saveError}</p>
          </CardContent>
        </Card>
      )}

      {isEditing && (
        <Card className="mb-4 border-primary/20 shadow-sm">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-xl sm:text-2xl">Edit Staff Profile</CardTitle>
            <CardDescription className="mt-1 text-sm sm:text-base">
              Update the employee name, code, branch, department, and status.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <Input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Employee code</label>
                <Input value={editForm.employee_code} onChange={(event) => setEditForm((current) => ({ ...current, employee_code: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Branch</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editForm.branchId}
                  onChange={(event) => setEditForm((current) => ({ ...current, branchId: event.target.value, departmentId: '' }))}
                >
                  <option value="">No branch</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Department</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editForm.departmentId}
                  onChange={(event) => setEditForm((current) => ({ ...current, departmentId: event.target.value }))}
                >
                  <option value="">No department</option>
                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="employee-active"
                type="checkbox"
                checked={editForm.is_active}
                onChange={(event) => setEditForm((current) => ({ ...current, is_active: event.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="employee-active" className="text-sm font-medium text-foreground">
                Active employee
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveEmployee} disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  router.replace(`/staff/${staffId}`);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

        {/* Staff Information (Top) */}
        <Card className="mb-4 border-primary/20 shadow-sm">
          <CardHeader className="border-b pb-3">
            <div className="flex items-start justify-between">
              <div>
                {/* <CardTitle className="text-xl sm:text-2xl">Staff Information</CardTitle> */}
                <CardDescription className="mt-1 text-sm sm:text-base">
                  <p className='font-bold text-xl'>{employee.name}</p><span className="font-semibold text-foreground">{employee.employee_code}</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base text-foreground">{employee.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="text-base text-foreground">{employee.phone_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                  <p className="text-base text-foreground">
                    {employee.date_of_birth
                      ? new Date(employee.date_of_birth).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="text-base text-foreground">{employee.address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Branch / Department</p>
                  <p className="text-base text-foreground">
                    {employee.branch?.name || 'No branch'} · {employee.department?.name || 'No department'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Enterprise</p>
                  <p className="text-base text-foreground">{employee.enterprise?.name || 'N/A'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      

        <Card className="mb-4 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex text-xl font-bold justify-center mb-2 items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Attendance
            </CardTitle>
            <CardDescription className="text-center text-sm sm:text-base">
              Filter attendance by date range and review present, late, early, and worked hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="p-3 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
                  <div className="text-xs uppercase text-muted-foreground">Present</div>
                  <div className="text-xl font-semibold">{presentDays}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <XCircle className="mx-auto mb-2 h-5 w-5 text-rose-600" />
                  <div className="text-xs uppercase text-muted-foreground">Absent</div>
                  <div className="text-xl font-semibold">{absentDays}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Clock className="mx-auto mb-2 h-5 w-5 text-amber-600" />
                  <div className="text-xs uppercase text-muted-foreground">Late</div>
                  <div className="text-xl font-semibold">{lateDays}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <AlertCircle className="mx-auto mb-2 h-5 w-5 text-orange-600" />
                  <div className="text-xs uppercase text-muted-foreground">Early</div>
                  <div className="text-xl font-semibold">{earlyDays}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Calendar className="mx-auto mb-2 h-5 w-5 text-blue-600" />
                  <div className="text-xs uppercase text-muted-foreground">Total Days</div>
                  <div className="text-xl font-semibold">{employeeDays.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Clock className="mx-auto mb-2 h-5 w-5 text-violet-600" />
                  <div className="text-xs uppercase text-muted-foreground">Worked Hours</div>
                  <div className="text-xl font-semibold">{workedHours}</div>
                </CardContent>
              </Card>
            </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between">
                <div className="text-sm text-muted-foreground">Filter by any date range:</div>
                <div>

              <Input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="sm:w-[180px]" />
              <Input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="sm:w-[180px]" />
              <Button onClick={applyDateFilter} disabled={attendanceLoading}>Apply</Button>
                </div>
            </div>

            {attendanceLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : attendanceError ? (
              <div className="text-sm text-destructive">{attendanceError}</div>
            ) : employeeDays.length === 0 ? (
              <div className="text-sm text-muted-foreground">No attendance data found for this range.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Late By</TableHead>
                      <TableHead>Early By</TableHead>
                      <TableHead>Worked Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeDays.map((day) => (
                      <TableRow key={day.attendance_date}>
                        <TableCell>{formatDateLabel(day.attendance_date)}</TableCell>
                        <TableCell>
                          <Badge variant={day.present ? 'default' : 'secondary'}>
                            {day.present ? 'Present' : 'Absent'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatTimeLabel(day.first_check_in)}</TableCell>
                        <TableCell>{formatTimeLabel(day.last_check_out)}</TableCell>
                        <TableCell>{secondsToMinutesLabel(day.late_seconds)}</TableCell>
                        <TableCell>{secondsToMinutesLabel(day.early_seconds)}</TableCell>
                        <TableCell>{Number(day.worked_hours || 0).toFixed(2)}</TableCell>
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
