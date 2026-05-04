# Visual Architecture Diagrams

## System Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Frontend)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  AdminDashboard Page                    │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  EnterpriseView / BranchView / DepartmentView   │  │   │
│  │  │  (Conditional rendering based on viewLevel)     │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                          ↓                              │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │           API Client (apiClient)                │  │   │
│  │  │ - dashboard.getHierarchical()                    │  │   │
│  │  │ - dashboard.getBranch(branchId)                 │  │   │
│  │  │ - dashboard.getDepartment(departmentId)         │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓↓↓ HTTP ↓↓↓                          │
└─────────────────────────────────────────────────────────────────┘
                            ⬇
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Django API)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Hierarchical Dashboard Views               │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  HierarchicalDashboardAPIView                    │  │   │
│  │  │  GET /api/dashboard/hierarchical/                │  │   │
│  │  │  - _get_user_enterprise()                        │  │   │
│  │  │  - _build_enterprise_view()                      │  │   │
│  │  │  - _build_branch_view()                          │  │   │
│  │  │  - _build_department_view()                      │  │   │
│  │  │  - _calculate_stats()                            │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  BranchDashboardAPIView                          │  │   │
│  │  │  GET /api/dashboard/branch/<id>/                 │  │   │
│  │  │  (uses HierarchicalDashboardAPIView helpers)     │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  DepartmentDashboardAPIView                      │  │   │
│  │  │  GET /api/dashboard/department/<id>/             │  │   │
│  │  │  (uses HierarchicalDashboardAPIView helpers)     │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │             Service Functions                           │   │
│  │  - build_dashboard_rows()   (Attendance row builder)   │   │
│  │  - build_dashboard_stats()  (KPI calculator)           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Models & ORM                          │   │
│  │  Enterprise → Branch → Department → Employee          │   │
│  │         → DailyAttendance                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
└─────────────────────────────────────────────────────────────────┘
                            ⬇
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (SQLite/PostgreSQL)                 │
│  - enterprise table                                             │
│  - branch table                                                 │
│  - department table                                             │
│  - employee table                                               │
│  - attendance_dailyattendance table                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Request Flow

### 1. Enterprise View Request
```
User loads /admin-dashboard
         ↓
Browser calls apiClient.dashboard.getHierarchical()
         ↓
HTTP GET /attendance/api/dashboard/hierarchical/
         ↓
Backend HierarchicalDashboardAPIView.get()
         ↓
_get_user_enterprise() → Get Enterprise from DB
         ↓
_build_enterprise_view(enterprise)
    ├─ Get all Branches
    ├─ Get all root Departments
    ├─ For each Branch:
    │   ├─ Get departments in branch
    │   ├─ Get employees in branch
    │   ├─ Get attendance for those employees
    │   └─ _calculate_stats()
    │
    └─ For each root Department:
        ├─ Get employees in dept
        ├─ Get attendance for those employees
        └─ _calculate_stats()
         ↓
Return JSON with enterprise, branches, departments
         ↓
Frontend receives data
         ↓
Renders EnterpriseView component
         ↓
User sees enterprise overview with branch/dept cards
```

### 2. Branch Detail Request
```
User clicks branch card
         ↓
setSelectedBranchId(branchId)
setViewLevel('branch')
         ↓
useEffect triggers with new state
         ↓
Browser calls apiClient.dashboard.getBranch(branchId)
         ↓
HTTP GET /attendance/api/dashboard/branch/<id>/
         ↓
Backend BranchDashboardAPIView.get(branch_id)
         ↓
Get Branch from DB
         ↓
Use HierarchicalDashboardAPIView._build_branch_view()
with summarize=false (full employee data)
    ├─ Get departments in branch
    ├─ Get ALL employees in branch
    ├─ Get attendance for those employees (full rows)
    ├─ _calculate_stats() for branch
    └─ For each department:
        ├─ Get employees in dept
        ├─ Get attendance
        └─ _calculate_stats()
         ↓
Return JSON with branch, departments, attendance_rows
         ↓
Frontend receives data
         ↓
Renders BranchView component
         ↓
User sees branch detail with departments + employee table
```

### 3. Department Detail Request
```
User clicks department card
         ↓
setSelectedDepartmentId(deptId)
setViewLevel('department')
         ↓
useEffect triggers with new state
         ↓
Browser calls apiClient.dashboard.getDepartment(deptId)
         ↓
HTTP GET /attendance/api/dashboard/department/<id>/
         ↓
Backend DepartmentDashboardAPIView.get(department_id)
         ↓
Get Department from DB
         ↓
Use HierarchicalDashboardAPIView._build_department_view()
with summarize=false (full attendance data)
    ├─ Get ALL employees in department
    ├─ Get FULL attendance for those employees
    │   (includes breaks, overtime, etc.)
    ├─ Build serialized rows with all details
    └─ _calculate_stats() for department
         ↓
Return JSON with department, attendance_rows (detailed)
         ↓
Frontend receives data
         ↓
Renders DepartmentView component
         ↓
User sees department detail with full employee attendance table
```

---

## Component Rendering Tree

```
AdminDashboard (page.tsx)
├── State:
│   ├── viewLevel ('enterprise' | 'branch' | 'department')
│   ├── selectedBranchId (number | null)
│   ├── selectedDepartmentId (number | null)
│   ├── viewData (response data or null)
│   ├── loading (boolean)
│   └── error (string | null)
│
├── Navbar
│   └── "EziHR - Admin Dashboard"
│
├── Breadcrumb Navigation
│   └── Enterprise → Branch → Department (dynamic)
│
├── KPI Cards Section
│   ├── StatCard (Total Employees)
│   ├── StatCard (Present Today)
│   ├── StatCard (Absent Today)
│   └── StatCard (Avg Hours)
│
├── IF viewLevel === 'enterprise'
│   └── EnterpriseView
│       ├── Enterprise Name
│       ├── Branches Grid
│       │   ├── Card (Branch 1)
│       │   ├── Card (Branch 2)
│       │   └── ...more cards
│       └── Root Departments Grid
│           ├── Card (Department X)
│           ├── Card (Department Y)
│           └── ...more cards
│
├── ELSE IF viewLevel === 'branch'
│   └── BranchView
│       ├── Branch Name
│       ├── Departments in Branch Grid
│       │   ├── Card (Department 1)
│       │   ├── Card (Department 2)
│       │   └── ...more cards
│       └── Employee Attendance Table
│           ├── TableHeader
│           └── TableBody
│               ├── Row (Employee 1)
│               ├── Row (Employee 2)
│               └── ...more rows
│
└── ELSE IF viewLevel === 'department'
    └── DepartmentView
        ├── Department Name
        └── Employee Attendance Table
            ├── TableHeader (with all details)
            └── TableBody
                ├── Row (Employee 1 - full details)
                ├── Row (Employee 2 - full details)
                └── ...more rows
```

---

## State Management Flow

```
Component Mount
        ↓
Initialize State:
├─ viewLevel = 'enterprise'
├─ selectedBranchId = null
├─ selectedDepartmentId = null
├─ viewData = null
├─ loading = true
└─ error = null
        ↓
useEffect (check auth)
├─ Is user authenticated?
├─ NO → Redirect to login
└─ YES → Continue
        ↓
useEffect (load data - depends on viewLevel, selectedBranchId, selectedDepartmentId)
├─ IF viewLevel === 'enterprise'
│   └─ loadData() → apiClient.dashboard.getHierarchical()
│       ├─ setLoading(true)
│       ├─ API call → Response
│       ├─ setViewData(response)
│       ├─ setError(null)
│       └─ setLoading(false)
│
├─ ELSE IF viewLevel === 'branch' && selectedBranchId
│   └─ loadData() → apiClient.dashboard.getBranch(selectedBranchId)
│       ├─ setLoading(true)
│       ├─ API call → Response
│       ├─ setViewData(response)
│       ├─ setError(null)
│       └─ setLoading(false)
│
└─ ELSE IF viewLevel === 'department' && selectedDepartmentId
    └─ loadData() → apiClient.dashboard.getDepartment(selectedDepartmentId)
        ├─ setLoading(true)
        ├─ API call → Response
        ├─ setViewData(response)
        ├─ setError(null)
        └─ setLoading(false)
        ↓
Render appropriate component:
├─ IF loading → Show skeleton loaders
├─ ELSE IF error → Show error card
├─ ELSE → Render EnterpriseView / BranchView / DepartmentView
        ↓
User interacts:
├─ Click branch → setSelectedBranchId(id), setViewLevel('branch')
│   → Triggers useEffect → Loads branch data
│
├─ Click department → setSelectedDepartmentId(id), setViewLevel('department')
│   → Triggers useEffect → Loads department data
│
└─ Click breadcrumb → Resets state → Triggers useEffect
```

---

## Data Transformation Pipeline

### API Response → Component Props → Rendered UI

```
JSON Response from Backend
        ↓
Parse to TypeScript Types:
├─ HierarchicalDashboardData
├─ BranchDashboardData
└─ DepartmentDashboardData
        ↓
Store in viewData state
        ↓
Pass to Component:
├─ EnterpriseView receives: HierarchicalDashboardData
│   ├─ Extract: enterprise.branches[]
│   ├─ Extract: enterprise.departments_root[]
│   └─ Extract: enterprise.stats
│       ↓
│   Render:
│   ├─ Branch Cards
│   │   ├─ branch.id → onClick handler
│   │   ├─ branch.name → Display text
│   │   ├─ branch.stats.total_employees → Card content
│   │   ├─ branch.stats.present_today → Badge
│   │   └─ branch.stats.average_worked_hours → Metric
│   │
│   └─ Department Cards
│       └─ (same structure as branches)
│
├─ BranchView receives: BranchDashboardData
│   ├─ Extract: branch.departments[]
│   ├─ Extract: branch.attendance_rows[]
│   └─ Extract: branch.stats
│       ↓
│   Render:
│   ├─ Department Cards
│   └─ Attendance Table
│       ├─ TableHead: Columns
│       └─ TableBody: Rows from attendance_rows
│           └─ For each row:
│               ├─ row.employee.name → Cell
│               ├─ row.present → Badge styling
│               ├─ row.check_in → Time format
│               ├─ row.check_out → Time format
│               └─ row.worked_minutes / 60 → Hours
│
└─ DepartmentView receives: DepartmentDashboardData
    ├─ Extract: department.attendance_rows[]
    └─ Extract: department.stats
        ↓
    Render:
    └─ Attendance Table (with full details)
        └─ For each row:
            ├─ row.employee.name
            ├─ row.present → Badge
            ├─ row.check_in → Time format
            ├─ row.check_out → Time format
            ├─ row.break_out → Time format
            ├─ row.break_in → Time format
            ├─ row.ot_in → Time format (optional)
            ├─ row.ot_out → Time format (optional)
            └─ row.worked_minutes / 60 → Hours
```

---

## Database Query Hierarchy

```
Enterprise View
    ├─ Query: GET Enterprise WHERE user_enterprise_id = ?
    │
    ├─ Query: GET Branches WHERE enterprise_id = ?
    │   └─ For each Branch:
    │       ├─ Query: GET Departments WHERE branch_id = ? AND enterprise_id = ?
    │       │   └─ For each Department:
    │       │       ├─ Query: GET Employees WHERE department_id = ? AND is_active = true
    │       │       └─ Query: GET DailyAttendance WHERE employee_id IN (...) AND date = TODAY()
    │       │
    │       └─ Query: GET Employees WHERE branch_id = ? AND is_active = true
    │           └─ Query: GET DailyAttendance WHERE employee_id IN (...) AND date = TODAY()
    │
    └─ Query: GET Departments WHERE enterprise_id = ? AND branch_id IS NULL
        └─ For each Department:
            ├─ Query: GET Employees WHERE department_id = ? AND is_active = true
            └─ Query: GET DailyAttendance WHERE employee_id IN (...) AND date = TODAY()
                        ↓
              Calculate Stats:
              ├─ COUNT(employees) → total_employees
              ├─ COUNT(present=true) → present_today
              ├─ COUNT(present=false) → absent_today
              ├─ AVG(worked_minutes) → average_worked_hours
              ├─ MAX(worked_minutes) → highest_working_time
              └─ MIN(worked_minutes) → lowest_working_time

Branch View
    ├─ Query: GET Branch WHERE id = ?
    │
    ├─ Query: GET Departments WHERE branch_id = ?
    │   └─ For each Department:
    │       ├─ Query: GET Employees WHERE department_id = ? AND is_active = true
    │       └─ Query: GET DailyAttendance WHERE employee_id IN (...) AND date = TODAY()
    │
    ├─ Query: GET Employees WHERE branch_id = ? AND is_active = true
    │
    └─ Query: GET DailyAttendance WHERE employee_id IN (...) AND date = TODAY()
                    ↓
          Return full attendance_rows with employee details

Department View
    ├─ Query: GET Department WHERE id = ?
    │
    ├─ Query: GET Employees WHERE department_id = ? AND is_active = true
    │
    └─ Query: GET DailyAttendance WHERE employee_id IN (...) AND date = TODAY()
                    ↓
          Return full attendance_rows with all details
```

---

## Error Handling Flow

```
User Request
        ↓
Try:
├─ setLoading(true)
├─ API Call
│   ├─ Success → Parse response
│   └─ Error → throw Error(message)
├─ setViewData(response)
├─ setError(null)
│
Catch Error:
├─ error is Error → setError(error.message)
└─ error is unknown → setError('Failed to load data')
│
Finally:
└─ setLoading(false)
        ↓
Component Render:
├─ IF loading === true → Show Skeleton loaders
├─ ELSE IF error !== null → Show Error Card with message
└─ ELSE → Show appropriate view (Enterprise/Branch/Department)
```

---

## Permission & Authentication Check

```
Page Load: /admin-dashboard
        ↓
useAuth() hook:
├─ Get user from context/storage
├─ Check isAuthenticated
└─ Check loading state
        ↓
useEffect (auth check):
├─ IF authLoading === true
│   └─ Show loading skeleton
│
├─ ELSE IF isAuthenticated === false
│   └─ router.push('/login')
│
└─ ELSE IF isAuthenticated === true
    ├─ Check user?.is_staff
    │   ├─ If false → return null (user not admin)
    │   └─ If true → Load dashboard data
    │
    └─ Call API (includes token in header)
        └─ Backend checks:
            ├─ IsAuthenticated
            └─ IsAdminUser
                ├─ Both pass → Return data
                └─ Either fails → Return 403 Forbidden
```

---

## Summary

This hierarchical architecture allows:
1. **Clean separation** between views
2. **Reusable components** (StatCard used everywhere)
3. **Efficient data loading** (only load what you need)
4. **Type safety** (TypeScript interfaces)
5. **Error handling** (show user-friendly errors)
6. **State management** (React hooks)
7. **Performance** (conditional rendering)
