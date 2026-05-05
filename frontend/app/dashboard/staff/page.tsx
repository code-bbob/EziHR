'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, type EnterpriseHierarchyItem } from '@/lib/api-client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useFilters } from '@/hooks/useFilters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, Building2, ChevronRight, Pencil, Search, ShieldCheck, Users, Loader } from 'lucide-react';

type StaffItem = {
  id: number;
  employee_code: string;
  name: string;
  is_active?: boolean;
  branch?: { id: number; name: string } | null;
  department?: { id: number; name: string } | null;
  user?: { is_superuser?: boolean; is_admin?: boolean } | null;
  created_at?: string;
};

export default function StaffPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { selectedBranchId, selectedDepartmentId, clearFilters } = useFilters();

  const [hierarchy, setHierarchy] = useState<EnterpriseHierarchyItem[]>([]);
  const [employees, setEmployees] = useState<StaffItem[]>([]);
  const [allEmployees, setAllEmployees] = useState<StaffItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [showAllLoading, setShowAllLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    // Only load hierarchy here. Employee list is fetched per-page in a separate effect
    if (!isAuthenticated) return;
    let cancelled = false;

    const loadHierarchy = async () => {
      try {
        setError(null);
        const hierarchyResponse = await apiClient.enterprise.hierarchy();
        if (cancelled) return;
        setHierarchy(hierarchyResponse.enterprises || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
      }
    };

    loadHierarchy();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, selectedBranchId, selectedDepartmentId]);

  // Fetch employees for the current page (server-side pagination)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (showAll) return; // when showing all, don't fetch per-page

    let cancelled = false;

    const loadPage = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (selectedBranchId) params.append('branch_id', String(selectedBranchId));
        if (selectedDepartmentId) params.append('department_id', String(selectedDepartmentId));
        params.append('page', String(currentPage));

        const queryString = params.toString();
        const response = await apiClient.request<any>(`/enterprise/api/employees/${queryString ? `?${queryString}` : ''}`);

        if (cancelled) return;

        const results = Array.isArray(response?.results)
          ? response.results
          : Array.isArray(response)
            ? response
            : [];

        setTotalCount(response?.count || results.length);
        setEmployees(results.map((employee: any) => ({
          id: employee.id,
          employee_code: employee.employee_code,
          name: employee.name,
          is_active: employee.is_active,
          branch: employee.branch ? { id: employee.branch.id, name: employee.branch.name } : null,
          department: employee.department ? { id: employee.department.id, name: employee.department.name } : null,
          user: employee.user,
          created_at: employee.created_at,
        })));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load staff directory');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, selectedBranchId, selectedDepartmentId, currentPage, showAll]);

  const activeEnterprise = hierarchy[0] || null;
  const branchName = useMemo(() => {
    if (!selectedBranchId) return null;
    return activeEnterprise?.branches?.find((branch) => branch.id === selectedBranchId)?.name || null;
  }, [activeEnterprise, selectedBranchId]);

  const handleShowAll = async () => {
    try {
      setShowAllLoading(true);
      setError(null);
      const allEmployeeResponse = await apiClient.employees.listAllWithFilters(selectedBranchId, selectedDepartmentId);
      
      const results = Array.isArray(allEmployeeResponse?.results)
        ? allEmployeeResponse.results
        : Array.isArray(allEmployeeResponse)
          ? allEmployeeResponse
          : [];

      const mapped = results.map((employee: any) => ({
        id: employee.id,
        employee_code: employee.employee_code,
        name: employee.name,
        is_active: employee.is_active,
        branch: employee.branch ? { id: employee.branch.id, name: employee.branch.name } : null,
        department: employee.department ? { id: employee.department.id, name: employee.department.name } : null,
        user: employee.user,
        created_at: employee.created_at,
      }));

      setAllEmployees(mapped);
      setTotalCount(allEmployeeResponse?.count || results.length);
      setShowAll(true);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load all staff');
    } finally {
      setShowAllLoading(false);
    }
  };

  const departmentName = useMemo(() => {
    if (!selectedDepartmentId) return null;
    return activeEnterprise?.departments?.find((department) => department.id === selectedDepartmentId)?.name || null;
  }, [activeEnterprise, selectedDepartmentId]);

  const filteredEmployees = useMemo(() => {
    const source = showAll && allEmployees ? allEmployees : employees;
    const query = search.trim().toLowerCase();
    if (!query) return source;

    return source.filter((employee) => {
      const haystack = [
        employee.name,
        employee.employee_code,
        employee.branch?.name,
        employee.department?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [employees, allEmployees, search, showAll]);

  const itemsPerPage = 30;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  // When not showing all, `employees` already contains the current page returned by the server.
  // So we should use the current page's items directly. Only slice when showAll (client-side slicing).
  const paginatedEmployees = showAll ? filteredEmployees.slice(0, filteredEmployees.length) : filteredEmployees;
  const totalPages = showAll ? Math.ceil(filteredEmployees.length / itemsPerPage) : Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const displayStart = showAll ? (filteredEmployees.length ? 1 : 0) : startIndex + 1;
  const displayEnd = showAll ? Math.min(filteredEmployees.length, endIndex) : startIndex + paginatedEmployees.length;

  const totalEmployees = filteredEmployees.length;
  const activeEmployees = filteredEmployees.filter((employee) => employee.is_active !== false).length;
  const adminEmployees = filteredEmployees.filter((employee) => employee.user?.is_admin).length;
  const capacityLimit = activeEnterprise?.max_alowed_employees || 0;
  const sourceEmployees = showAll && allEmployees ? allEmployees : employees;
  const capacityRatio = capacityLimit > 0 ? Math.min((sourceEmployees.length / capacityLimit) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-[28rem] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Users className="h-3.5 w-3.5" />
            Staff Directory
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Manage staff with branch-aware precision.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Browse, inspect, and jump into employee profiles using the branch and department selections from the sidebar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {branchName ? (
              <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                <Building2 className="h-3.5 w-3.5" />
                {branchName}
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full px-3 py-1">All branches</Badge>
            )}
            {departmentName ? (
              <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                <ChevronRight className="h-3.5 w-3.5" />
                {departmentName}
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full px-3 py-1">All departments</Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
          <Button className="justify-start gap-2 rounded-2xl" onClick={() => router.push('/dashboard/staff')}>
            <ArrowRight className="h-4 w-4" />
            Refresh view
          </Button>
          <Button variant="outline" className="justify-start gap-2 rounded-2xl" onClick={() => clearFilters()}>
            Reset filters
          </Button>
          <Button variant="secondary" className="justify-start gap-2 rounded-2xl" onClick={() => router.push('/settings')}>
            <Pencil className="h-4 w-4" />
            Open settings
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Filtered staff</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{totalEmployees}</div>
            <p className="mt-1 text-xs text-muted-foreground">Matches current sidebar selection</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active staff</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{activeEmployees}</div>
            <p className="mt-1 text-xs text-muted-foreground">Currently active employees</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
            <Pencil className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{adminEmployees}</div>
            <p className="mt-1 text-xs text-muted-foreground">Staff with elevated access</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacity</CardTitle>
            <Building2 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div className="text-3xl font-semibold tracking-tight">
                {capacityLimit > 0 ? `${sourceEmployees.length}/${capacityLimit}` : `${sourceEmployees.length}`}
              </div>
              <div className="text-xs text-muted-foreground">{capacityLimit > 0 ? `${capacityRatio.toFixed(0)}% used` : 'No limit set'}</div>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${capacityRatio}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-border/60 shadow-sm">
        <CardHeader className="space-y-4 border-b border-border/60">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-xl">Employees</CardTitle>
              <CardDescription>
                Click any row to open the profile; use edit for quick updates.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, code, branch, or department"
                  className="h-11 rounded-2xl pl-9"
                />
              </div>
              <Button 
                onClick={handleShowAll}
                disabled={showAllLoading || showAll}
                variant={showAll ? "secondary" : "outline"}
                className="rounded-2xl gap-2 whitespace-nowrap"
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEmployees.length === 0 ? (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/60" />
              <div>
                <h3 className="text-lg font-semibold">No staff found</h3>
                <p className="text-sm text-muted-foreground">
                  Try changing the branch or department selection, or clear the search term.
                </p>
              </div>
              <Button variant="outline" onClick={() => setSearch('')}>
                Clear search
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Employee</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmployees.map((employee) => (
                      <TableRow
                        key={employee.id}
                        className="cursor-pointer transition-colors hover:bg-primary/5"
                        onClick={() => router.push(`/staff/${employee.id}`)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {employee.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{employee.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {employee.user?.is_admin || employee.user?.is_superuser ? 'Administrator' : 'Staff member'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{employee.employee_code}</TableCell>
                        <TableCell>{employee.branch?.name || '—'}</TableCell>
                        <TableCell>{employee.department?.name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={employee.is_active === false ? 'secondary' : 'default'} className="rounded-full px-3 py-1">
                            {employee.is_active === false ? 'Inactive' : 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(`/staff/${employee.id}`);
                              }}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-full"
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(`/staff/${employee.id}?edit=1`);
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls */}
              <div className="flex items-center justify-between gap-4 border-t border-border/60 px-6 py-4">
                <div className="text-sm text-muted-foreground">
                  {showAll ? (
                    <>Showing all {filteredEmployees.length} results</>
                  ) : (
                    <>
                      Showing {displayStart}–{displayEnd} of {totalCount} results
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
