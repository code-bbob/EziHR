# Hierarchical Dashboard - Testing & Usage Guide

## Quick Start

### 1. Access the Dashboard
Navigate to: `http://localhost:3000/admin-dashboard` (or your frontend URL)

The dashboard requires admin authentication. You'll be redirected to login if not authenticated.

---

## Dashboard Levels Overview

### Level 1: Enterprise View (Default)
**URL:** `/admin-dashboard`
**Shows:** Enterprise-wide overview

**What You See:**
- **KPI Cards** at the top showing:
  - Total Employees (across entire enterprise)
  - Present Today (across entire enterprise)
  - Absent Today (across entire enterprise)
  - Average Hours Worked (across entire enterprise)
  
- **Branches Section**: Grid of clickable branch cards
  - Each card shows branch name
  - Employee count for that branch
  - Present employees in that branch
  - Average hours for that branch
  
- **Root Departments Section**: Grid of departments not assigned to any branch
  - Similar stats as branches
  - Clickable to go to department view

**How to Navigate:**
- Click any branch card → Goes to **Branch View**
- Click any root department card → Goes to **Department View**
- Breadcrumb shows: `Enterprise`

---

### Level 2: Branch View (Detailed)
**URL:** `/admin-dashboard?branch=<branch_id>`
**Shows:** Branch-specific detailed view

**What You See:**
- **KPI Cards** showing branch-specific metrics
- **Branch Name** as heading
- **Departments in Branch Section**: Grid of departments within this branch
  - Each card shows department name
  - Employee count
  - Present employees
  - Average hours
  - Clickable to go deeper
  
- **All Employees Table**: Complete table of everyone in this branch
  - Employee name & code
  - Presence status (badge: Present/Absent)
  - First check-in time
  - Last check-out time
  - Total logged hours

**How to Navigate:**
- Click any department card → Goes to **Department View**
- Click "Enterprise" in breadcrumb → Back to **Enterprise View**
- Breadcrumb shows: `Enterprise > Branch 1`

---

### Level 3: Department View (Most Detailed)
**URL:** `/admin-dashboard?department=<department_id>`
**Shows:** Department-specific detailed view with full attendance info

**What You See:**
- **KPI Cards** showing department-specific metrics
- **Department Name** as heading
- **Employee Attendance Table**: Detailed table with ALL attendance data
  - Employee name & code
  - Presence status (badge color: green for present, red for absent)
  - First Check-In time
  - Last Check-Out time
  - Total Logged Hours
  - Break times (shown in data)
  - Overtime hours (if any)

**How to Navigate:**
- Click "Enterprise" in breadcrumb → Back to **Enterprise View**
- Click branch name in breadcrumb (if applicable) → Back to **Branch View**
- Breadcrumb shows: `Enterprise > Branch 1 > Department 1` (or just `Enterprise > Department 1` for root departments)

---

## Breadcrumb Navigation

The breadcrumb at the top always shows your current location and allows quick navigation:

```
Enterprise
├─ (click) → Back to Enterprise View
├─ Branch 1
│  ├─ (click) → Back to Branch View
│  └─ Department 1
│     └─ (click) → Back to Department View
```

---

## KPI Cards

These metrics appear at every level and adjust based on what you're viewing:

| Metric | Description | Enterprise View | Branch View | Department View |
|--------|-------------|-----------------|-------------|-----------------|
| **Total Employees** | Count of active employees | Entire enterprise | This branch only | This department only |
| **Present Today** | Employees marked as present | All present employees | Present in branch | Present in department |
| **Absent Today** | Employees marked as absent | All absent employees | Absent in branch | Absent in department |
| **Avg Hours** | Average worked hours | Enterprise average | Branch average | Department average |

---

## How Data Flows

### Enterprise View Endpoint
```
GET /attendance/api/dashboard/hierarchical/

Returns:
{
  "enterprise": {
    "name": "My Company",
    "stats": { total_employees, present_today, absent_today, ... },
    "branches": [
      { "id": 1, "name": "HQ", "stats": {...}, "departments": [...] },
      { "id": 2, "name": "Branch 2", "stats": {...}, "departments": [...] }
    ],
    "departments_root": [
      { "id": 5, "name": "HR", "stats": {...} }
    ]
  },
  "attendance_date": "2026-04-30"
}
```

### Branch View Endpoint
```
GET /attendance/api/dashboard/branch/1/

Returns:
{
  "branch": {
    "name": "HQ",
    "stats": { total_employees, present_today, absent_today, ... },
    "departments": [
      { "id": 10, "name": "Engineering", "stats": {...} },
      { "id": 11, "name": "Sales", "stats": {...} }
    ],
    "attendance_rows": [
      {
        "employee": { "id": 1, "name": "John Doe", "employee_code": "EMP001" },
        "present": true,
        "check_in": "2026-04-30T09:00:00",
        "check_out": "2026-04-30T17:30:00",
        "worked_minutes": 510
      },
      ...
    ]
  },
  "attendance_date": "2026-04-30"
}
```

### Department View Endpoint
```
GET /attendance/api/dashboard/department/10/

Returns:
{
  "department": {
    "name": "Engineering",
    "stats": { total_employees, present_today, absent_today, ... },
    "attendance_rows": [
      {
        "employee": { "id": 1, "name": "John Doe", "employee_code": "EMP001", ... },
        "present": true,
        "check_in": "2026-04-30T09:00:00",
        "check_out": "2026-04-30T17:30:00",
        "break_out": "2026-04-30T12:00:00",
        "break_in": "2026-04-30T13:00:00",
        "ot_in": null,
        "ot_out": null,
        "worked_minutes": 480
      },
      ...
    ]
  },
  "attendance_date": "2026-04-30"
}
```

---

## Test Scenarios

### Test 1: Basic Navigation
1. Go to `/admin-dashboard`
2. Verify you see enterprise overview with branches
3. Click on any branch card
4. Verify you see branch details with departments and employee table
5. Click on any department
6. Verify you see department details with full employee table
7. Use breadcrumb to navigate back

**Expected Result:** Smooth navigation between all three levels with correct data

---

### Test 2: KPI Accuracy
1. Go to enterprise view
2. Note the "Total Employees" count
3. Click on a branch
4. Note the "Total Employees" count for that branch
5. Verify branch count ≤ enterprise count
6. Click on a department
7. Verify department count ≤ branch count

**Expected Result:** Stats decrease or stay same as you drill down (never increase)

---

### Test 3: Presence Tracking
1. Go to department view (most detailed)
2. Look at employee presence in the table
3. Note present vs absent counts
4. Check if they match the KPI card "Present Today" / "Absent Today"

**Expected Result:** KPI numbers match the employee table data

---

### Test 4: Attendance Details
1. Go to department view
2. Verify you can see:
   - Employee name and code
   - Check-in time
   - Check-out time
   - Total worked hours
   - Green badge for Present, Red badge for Absent

**Expected Result:** All attendance details are visible and accurate

---

### Test 5: Multiple Departments in Branch
1. Go to a branch with multiple departments
2. Verify all departments are shown in the grid
3. Click each department
4. Verify each department shows its own employees and data

**Expected Result:** Correct filtering of employees by department

---

### Test 6: Root Departments (No Branch)
1. Go to enterprise view
2. Look for "Departments (No Branch)" section
3. Verify any root departments are shown
4. Click on a root department
5. Verify it shows its employees correctly

**Expected Result:** Root departments are handled properly

---

## Troubleshooting

### Problem: "No enterprise found" error
- **Cause:** User is not associated with an enterprise
- **Fix:** Make sure the logged-in user has an employee record with an enterprise assigned

### Problem: Empty departments/branches
- **Cause:** No employees assigned to those organizational units
- **Fix:** The app is working correctly; the units just have no active employees

### Problem: Attendance rows not showing
- **Cause:** No attendance records for today or employees aren't set up
- **Fix:** Check attendance system; verify employee devices are connected

### Problem: Wrong data showing
- **Cause:** Caching or stale data
- **Fix:** Refresh the page; clear browser cache

---

## Performance Tips

- The dashboard loads data for the current date only
- For enterprises with 100+ employees, consider adding pagination to tables in future
- Attendance rows are computed efficiently with filtered queries
- Stats use aggregated calculations for performance

---

## API Reference

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/attendance/api/dashboard/hierarchical/` | GET | Enterprise overview | `HierarchicalDashboardData` |
| `/attendance/api/dashboard/branch/<id>/` | GET | Branch detail | `BranchDashboardData` |
| `/attendance/api/dashboard/department/<id>/` | GET | Department detail | `DepartmentDashboardData` |

All endpoints require authentication with admin/staff permissions.

---

## Components Used

### Backend (Django)
- `HierarchicalDashboardAPIView` - Main orchestrator
- `BranchDashboardAPIView` - Branch drill-down
- `DepartmentDashboardAPIView` - Department drill-down
- `build_dashboard_rows()` - Attendance row building
- `build_dashboard_stats()` - KPI calculation

### Frontend (React/Next.js)
- `AdminDashboard` - Main page component
- `EnterpriseView` - Enterprise-level display
- `BranchView` - Branch-level display
- `DepartmentView` - Department-level display
- `StatCard` - KPI metric cards

---

## Next Steps / Future Enhancements

1. **Pagination** - Add pagination for large employee tables
2. **Filters** - Add date range, department/branch filters
3. **Export** - Add CSV/Excel export for attendance data
4. **Search** - Add employee name/code search
5. **Charts** - Add visualizations (bar charts, pie charts)
6. **Real-time** - Update attendance data in real-time as people check in/out
7. **Trends** - Show attendance trends over time
