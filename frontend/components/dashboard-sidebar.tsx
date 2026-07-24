"use client";

import { ChevronRight, ChevronDown, PanelLeftIcon, ListChecks, MapPinned, Users, LogOut, X, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export type DashboardSidebarBranch = {
  id: number;
  name: string;
  stats?: {
    total_employees?: number;
    present_today?: number;
    absent_today?: number;
  };
};

export type DashboardSidebarDepartment = {
  id: number;
  name: string;
  branch_id?: number | null;
  stats?: {
    total_employees?: number;
    present_today?: number;
    absent_today?: number;
  };
};

export type DashboardSidebarEmployee = {
  id: number;
  name: string;
  employee_code?: string;
  is_admin?: boolean;
  stats?: {
    present?: boolean;
    check_in?: string | null;
    check_out?: string | null;
  };
};

export type DashboardSidebarEnterprise = {
  name: string;
  branches?: DashboardSidebarBranch[];
  departments_root?: DashboardSidebarDepartment[];
  stats?: {
    total_employees?: number;
    present_today?: number;
    absent_today?: number;
  };
};

interface DashboardSidebarProps extends React.ComponentProps<typeof Sidebar> {
  enterpriseName?: string;
  selectedBranchName?: string | null;
  attendanceDate?: string | null;
  totalEmployees?: number;
  presentCount?: number;
  absentCount?: number;
  currentLevel?: "enterprise" | "branch" | "department";
  selectedBranchId?: number | null;
  selectedDepartmentId?: number | null;
  selectedDepartmentName?: string | null;
  branches?: DashboardSidebarBranch[];
  departments?: DashboardSidebarDepartment[];
  employees?: DashboardSidebarEmployee[];
  onGoEnterprise?: () => void;
  onClearBranch?: () => void;
  onClearDepartment?: () => void;
  onSelectBranch?: (branchId: number) => void;
  onSelectDepartment?: (departmentId: number) => void;
  onSelectEmployee?: (employeeId: number) => void;
  onViewAttendance?: () => void;
  onViewStaff?: () => void;
  onViewDashboard?: () => void;
}

export function DashboardSidebar({
  enterpriseName: _enterpriseNameProp,
  selectedBranchName = null,
  attendanceDate,
  totalEmployees = 0,
  presentCount = 0,
  absentCount = 0,
  currentLevel = "enterprise",
  selectedBranchId = null,
  selectedDepartmentId = null,
  selectedDepartmentName = null,
  branches = [],
  departments = [],
  employees = [],
  onGoEnterprise,
  onClearBranch,
  onClearDepartment,
  onSelectBranch,
  onSelectDepartment,
  onSelectEmployee,
  onViewAttendance,
  onViewStaff,
  onViewDashboard,
  className,
  ...props
}: DashboardSidebarProps) {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  // On mobile the sidebar renders inside a Sheet — always show full content
  const collapsed = !isMobile && state === "collapsed";

  // Close the mobile Sheet after navigation so the user sees the page
  const closeMobileNav = () => {
    if (isMobile) setOpenMobile(false);
  };
  const [enterpriseName, setEnterpriseName] = useState("");
  const [expandedPlatform, setExpandedPlatform] = useState(true);
  const [expandedSelect, setExpandedSelect] = useState(true);
  const [expandedEmployees, setExpandedEmployees] = useState(true);
  const [totalEmployeeCount, setTotalEmployeeCount] = useState(0);

  // Local state populated from APIs
  const [localBranches, setLocalBranches] = useState<DashboardSidebarBranch[]>(branches || []);
  const [localDepartments, setLocalDepartments] = useState<DashboardSidebarDepartment[]>(departments || []);
  const [localEmployees, setLocalEmployees] = useState<DashboardSidebarEmployee[]>(employees || []);

  // Controlled/uncontrolled selection state (initialize from props)
  const [localSelectedBranchId, setLocalSelectedBranchId] = useState<number | null>(selectedBranchId ?? null);
  const [localSelectedDepartmentId, setLocalSelectedDepartmentId] = useState<number | null>(selectedDepartmentId ?? null);

  // Keep local selection in sync when parent props change
  useEffect(() => setLocalSelectedBranchId(selectedBranchId ?? null), [selectedBranchId]);
  useEffect(() => setLocalSelectedDepartmentId(selectedDepartmentId ?? null), [selectedDepartmentId]);

  // Fetch enterprise hierarchy (branches + departments) once on mount
  const fetchHierarchy = useCallback(async () => {
    try {
      const data = await apiClient.enterprise.hierarchy();
      const ent = Array.isArray(data?.enterprises) ? data.enterprises[0] : null;
      if (!ent) return;
      const fetchedBranches: DashboardSidebarBranch[] = (ent.branches || []).map((b: any) => ({ id: b.id, name: b.name }));
      const fetchedDepartments: DashboardSidebarDepartment[] = (ent.departments || []).map((d: any) => ({ id: d.id, name: d.name, branch_id: d.branch ? d.branch.id : null }));
      setLocalBranches(fetchedBranches);
      setLocalDepartments(fetchedDepartments);
      setEnterpriseName(ent.name);
    } catch (err) {
      // silent fail - do not change UI classes
    }
  }, []);

  // Fetch employees with optional branch/department filters
  const fetchEmployees = useCallback(async (branchId?: number | null, departmentId?: number | null) => {
    try {
      const data = await apiClient.employees.listWithFilters(branchId, departmentId);
      // DRF paginated response uses `results`
      const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      if (typeof data?.count === 'number') {
        setTotalEmployeeCount(data.count);
      } else {
        setTotalEmployeeCount(items.length);
      }
      const mapped: DashboardSidebarEmployee[] = items.map((e: any) => ({
        id: e.id,
        name: e.name,
        employee_code: e.employee_code,
        is_admin: Boolean(e.user?.is_admin || e.user?.is_superuser),
      }));
      setLocalEmployees(mapped);
    } catch (err) {
      // silent
    }
  }, []);

  useEffect(() => {
    // initial load
    fetchHierarchy();
  }, [fetchHierarchy]);

  useEffect(() => {
    // fetch employees whenever selection changes
    fetchEmployees(localSelectedBranchId, localSelectedDepartmentId);
  }, [localSelectedBranchId, localSelectedDepartmentId, fetchEmployees]);

  // Filter departments by selected branch (from fetched departments)
  const branchDepartments = localSelectedBranchId
    ? localDepartments.filter((dept) => dept.branch_id === localSelectedBranchId)
    : localDepartments;

  // Show up to 30 employees by default
  const displayedEmployees = localEmployees.slice(0, 30);

  return (
    <Sidebar collapsible="icon" className={cn("w-[16rem]", className)} {...props}>
      {/* Header */}
      <SidebarHeader className={cn("border-b border-sidebar-border px-4 py-4", collapsed && "px-2")}>
        <div className={cn("flex items-center justify-between", collapsed && "justify-center")}>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary font-semibold text-sm shrink-0">
              {!collapsed && enterpriseName.charAt(0).toUpperCase()}
              {collapsed && <span className="text-sm">E</span>}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight text-foreground">EziHR - <span className="text-primary">{enterpriseName}</span></p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {!selectedBranchName && !selectedDepartmentName && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      Enterprise
                    </span>
                  )}
                  {selectedBranchName && (
                    <div className="flex items-center gap-1 bg-sidebar-accent border border-sidebar-border px-2 py-1 rounded text-[12px] font-semibold text-foreground group transition-all hover:border-primary/30">
                      <span className="truncate max-w-[120px] mt-1">{selectedBranchName}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearBranch?.();
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                        title="Clear Branch"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}
                  {selectedDepartmentName && (
                    <div className="flex items-center gap-1 bg-primary/5 border border-primary/20 px-2 py-1 rounded text-[12px] font-semibold text-primary group transition-all hover:border-primary/40">
                      <span className="truncate max-w-[120px] mt-1">{selectedDepartmentName}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearDepartment?.();
                        }}
                        className="text-primary/60 hover:text-destructive transition-colors ml-0.5 mt-1"
                        title="Clear Department"
                      >
                        <X className="size-3.5 mb-1" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => toggleSidebar()}
              className="ml-auto p-1.5 hover:bg-sidebar-accent rounded-md transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftIcon className="size-4" />
            </button>
          )}
        </div>
        <SidebarMenu>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className=" px-0 ">
        {/* Selection Section */}
        <SidebarGroup className={cn("px-3", collapsed && "px-2")}>
          <button
            onClick={() => {
              setExpandedSelect(!expandedSelect);
              if (collapsed && !isMobile) toggleSidebar();
            }}
            className={cn(
              "w-full flex items-center justify-between px-0 py-",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Select" : undefined}
          >
            <SidebarGroupLabel className={cn(
              "text-xs font-semibold uppercase tracking-wider text-foreground/70 m-0",
              collapsed && "hidden"
            )}>
              SELECT
            </SidebarGroupLabel>
            {!collapsed && (
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  expandedSelect ? "rotate-0" : "-rotate-90"
                )}
              />
            )}
            {collapsed && (
              <MapPinned className="size-4 text-sidebar-foreground" />
            )}
          </button>
          {expandedSelect && !collapsed && (
            <SidebarGroupContent className=" px-0">
              <SidebarMenu className="gap-2">
                <div className="px-3 space-y-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Branch</label>
                    <select
                      className="w-full bg-sidebar-accent border-none rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                      value={localSelectedBranchId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setLocalSelectedBranchId(null);
                          setLocalSelectedDepartmentId(null);
                          onClearBranch?.();
                        } else {
                          const id = Number(val);
                          setLocalSelectedBranchId(id);
                          // clear department when branch changes
                          setLocalSelectedDepartmentId(null);
                          onSelectBranch?.(id);
                        }
                      }}
                    >
                      <option value="">All Branches</option>
                      {localBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Department</label>
                    <select
                      className="w-full bg-sidebar-accent border-none rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                      value={localSelectedDepartmentId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setLocalSelectedDepartmentId(null);
                          onClearDepartment?.();
                        } else {
                          const id = Number(val);
                          setLocalSelectedDepartmentId(id);
                          onSelectDepartment?.(id);
                        }
                      }}
                    >
                      <option value="">All Departments</option>
                      {branchDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Platform Section */}
        <SidebarGroup className={cn("px-3", collapsed && "px-2")}>
          <button
            onClick={() => {
              setExpandedPlatform(!expandedPlatform);
              if (collapsed && !isMobile) toggleSidebar();
            }}
            className={cn(
              "w-full flex items-center justify-between px-0 border-t border-sidebar-border pt-3",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Platform" : undefined}
          >
            <SidebarGroupLabel className={cn(
              "text-xs font-semibold uppercase tracking-wider text-foreground/70 m-0",
              collapsed && "hidden"
            )}>
              Platform
            </SidebarGroupLabel>
            {!collapsed && (
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  expandedPlatform ? "rotate-0" : "-rotate-90"
                )}
              />
            )}
            {collapsed && (
              <ListChecks className="size-4 text-sidebar-foreground" />
            )}
          </button>
          {expandedPlatform && !collapsed && (
            <SidebarGroupContent className="mt-3 px-0">
              <SidebarMenu className="gap-0.5">
                {/* Dashboard Item */}
                <SidebarMenuItem>
                  <button
                    onClick={() => {
                      onViewDashboard?.();
                      closeMobileNav();
                      if (collapsed) toggleSidebar();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-1 rounded-md text-sm font-medium transition-colors",
                      "hover:bg-sidebar-accent text-sidebar-foreground",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? "Dashboard" : undefined}
                  >
                    <LayoutDashboard className="size-4 shrink-0" />
                    {!collapsed && <span>Dashboard</span>}
                  </button>
                </SidebarMenuItem>

                {/* Attendance Item */}
                <SidebarMenuItem>
                  <button
                    onClick={() => {
                      onViewAttendance?.();
                      closeMobileNav();
                      if (collapsed) toggleSidebar();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-1 rounded-md text-sm font-medium transition-colors",
                      "hover:bg-sidebar-accent text-sidebar-foreground",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? "Attendance" : undefined}
                  >
                    <ListChecks className="size-4 shrink-0" />
                    {!collapsed && <span>Attendance</span>}
                  </button>
                </SidebarMenuItem>

                {/* Staffs Item */}
                <SidebarMenuItem>
                  <button
                    onClick={() => {
                      onViewStaff?.();
                      closeMobileNav();
                      if (collapsed) toggleSidebar();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-1 rounded-md text-sm font-medium transition-colors",
                      "hover:bg-sidebar-accent text-sidebar-foreground",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? "Staff Directory" : undefined}
                  >
                    <Users className="size-4 shrink-0" />
                    {!collapsed && <span>Staff Directory</span>}
                  </button>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Employees Section */}
        <SidebarGroup className={cn("px-3", collapsed && "px-2")}>
          <button
            onClick={() => {
              setExpandedEmployees(!expandedEmployees);
              if (collapsed && !isMobile) toggleSidebar();
            }}
            className={cn(
              "w-full flex items-center justify-between border-t border-sidebar-border px-0 py-1.5",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Staff" : undefined}
          >
            <SidebarGroupLabel className={cn(
              "text-xs font-semibold uppercase tracking-wider text-foreground/70 m-0",
              collapsed && "hidden"
            )}>
              Staff
            </SidebarGroupLabel>
            {!collapsed && (
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  expandedEmployees ? "rotate-0" : "-rotate-90"
                )}
              />
            )}
            {collapsed && (
              <Users className="size-4 text-sidebar-foreground" />
            )}
          </button>
          {expandedEmployees && !collapsed && (
          <SidebarGroupContent className="mt-3 px-0">
            <SidebarMenu className="gap-0.5">
                {displayedEmployees.map((employee) => (
                  <SidebarMenuItem key={employee.id}>
                    <button
                      onClick={() => {
                        router.push(`/staff/${employee.id}`);
                        onSelectEmployee?.(employee.id);
                        closeMobileNav();
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-foreground font-medium flex items-center gap-2"
                    >
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">
                          {employee.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{employee.name}</span>
                      {employee.is_admin && (
                        <span className="ml-auto text-xs font-medium text-primary whitespace-nowrap">(Admin)</span>
                      )}
                    </button>
                  </SidebarMenuItem>
                ))}
                {localEmployees.length === 0 && (
                  <p className="px-3 py-1.5 text-sm text-muted-foreground">No employees</p>
                )}
                {totalEmployeeCount > 30 && (
                  <button
                    onClick={() => {
                      onViewStaff?.();
                      closeMobileNav();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary rounded hover:bg-sidebar-accent transition-colors"
                  >
                    Show All {totalEmployeeCount} Staff
                  </button>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Info */}
      {/* <SidebarFooter className={cn("border-t border-sidebar-border px-4 py-3", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-3 px-0", collapsed && "justify-center")}>
          <Avatar className="size-9 shrink-0" title={collapsed ? enterpriseName : undefined}>
            <AvatarFallback className="text-xs bg-primary/15 text-primary font-semibold">
              {enterpriseName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Admin</p>
              <p className="text-xs text-muted-foreground truncate">m@example.com</p>
            </div>
          )}
        </div>
      </SidebarFooter> */}
    </Sidebar>
  );
}
