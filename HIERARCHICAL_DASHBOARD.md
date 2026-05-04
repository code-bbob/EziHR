# Hierarchical Dashboard Architecture

## Overview
The dashboard implements a 3-level drill-down navigation system:

### 1. **Enterprise Level** (Most Zoomed Out)
**Path:** `/admin-dashboard`
**Endpoint:** `GET /attendance/api/dashboard/hierarchical/`

Shows:
- Enterprise-wide KPI metrics (total employees, present today, absent, avg hours)
- Grid of all **Branches** with summarized stats
- Grid of **Root Departments** (departments not in any branch) with summarized stats
- Interactive cards to drill down into branch or department

**Data Structure:**
```json
{
  "enterprise": {
    "id": 1,
    "name": "Company Name",
    "stats": {
      "total_employees": 150,
      "present_today": 120,
      "absent_today": 30,
      "average_worked_hours": 8.5,
      "highest_working_time": {...},
      "lowest_working_time": {...}
    },
    "branches": [
      {
        "id": 1,
        "name": "Branch Name",
        "stats": {...},
        "departments": [...] // Summarized
      }
    ],
    "departments_root": [...] // Departments without a branch
  },
  "attendance_date": "2026-04-30"
}
```

---

### 2. **Branch Level** (Middle Detail)
**Path:** `/admin-dashboard?branch=<branch_id>`
**Endpoint:** `GET /attendance/api/dashboard/branch/<branch_id>/`

Shows:
- Branch-specific KPI metrics
- Grid of **Departments** in this branch with summarized stats
- **Full employee attendance table** for all employees in the branch
- Interactive department cards to drill down further

**Data Structure:**
```json
{
  "branch": {
    "id": 1,
    "name": "Branch Name",
    "stats": {...},
    "departments": [
      {
        "id": 1,
        "name": "Department Name",
        "stats": {...}
        // No attendance_rows here (summarized)
      }
    ],
    "attendance_rows": [
      {
        "employee": {...},
        "present": true,
        "check_in": "2026-04-30T09:00:00",
        "check_out": "2026-04-30T17:30:00",
        "worked_minutes": 510
      }
    ]
  },
  "attendance_date": "2026-04-30"
}
```

---

### 3. **Department Level** (Most Detailed)
**Path:** `/admin-dashboard?department=<department_id>`
**Endpoint:** `GET /attendance/api/dashboard/department/<department_id>/`

Shows:
- Department-specific KPI metrics
- **Detailed employee attendance table** with all attendance info
- Check-in/check-out times
- Worked hours
- Presence status

**Data Structure:**
```json
{
  "department": {
    "id": 1,
    "name": "Department Name",
    "stats": {...},
    "attendance_rows": [
      {
        "employee": {
          "id": 1,
          "name": "John Doe",
          "employee_code": "EMP001",
          "avatar": null,
          "is_active": true
        },
        "present": true,
        "check_in": "2026-04-30T09:00:00",
        "check_out": "2026-04-30T17:30:00",
        "break_out": "2026-04-30T12:00:00",
        "break_in": "2026-04-30T13:00:00",
        "ot_in": null,
        "ot_out": null,
        "worked_minutes": 480,
        "summary": {...}
      }
    ]
  },
  "attendance_date": "2026-04-30"
}
```

---

## Component Structure

### Frontend Components

#### `AdminDashboard` (Main Component)
- Manages state: `viewLevel` ('enterprise' | 'branch' | 'department')
- Handles navigation between levels
- Displays breadcrumb navigation
- Renders KPI cards at all levels

#### `EnterpriseView`
- Shows enterprise-wide overview
- Grid of branch cards (clickable)
- Grid of root department cards (clickable)
- Summary stats for each item

#### `BranchView`
- Shows branch-specific overview
- Grid of department cards in this branch (clickable)
- Full employee attendance table
- Summary stats for branch

#### `DepartmentView`
- Shows department-specific overview
- Detailed employee attendance table with all timing info
- Department-level statistics

---

## Navigation Flow

```
ENTERPRISE VIEW
├─ Click Branch → BRANCH VIEW
│  ├─ Click Department → DEPARTMENT VIEW
│  │  └─ Back via breadcrumb → BRANCH VIEW
│  └─ Back via breadcrumb → ENTERPRISE VIEW
│
└─ Click Root Department → DEPARTMENT VIEW
   └─ Back via breadcrumb → ENTERPRISE VIEW
```

---

## Key Features

### KPI Cards (Always Visible)
- Total Employees
- Present Today
- Absent Today
- Average Hours Worked

### Breadcrumb Navigation
Shows current location and allows jumping back to parent levels

### Summarization Strategy
- **Enterprise View**: Shows stats summary for branches/departments, no employee details
- **Branch View**: Shows stats summary for departments + full employee table for branch
- **Department View**: Full employee attendance details with all timing information

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/attendance/api/dashboard/hierarchical/` | GET | Enterprise overview with branches and root departments |
| `/attendance/api/dashboard/branch/<branch_id>/` | GET | Branch detail with departments and full employee table |
| `/attendance/api/dashboard/department/<department_id>/` | GET | Department detail with full employee attendance |

---

## Backend Implementation

### `HierarchicalDashboardAPIView`
Main view with helper methods:
- `_build_enterprise_view()` - Enterprise-level data
- `_build_branch_view()` - Branch-level data (with `summarize` parameter)
- `_build_department_view()` - Department-level data (with `summarize` parameter)
- `_calculate_stats()` - Computes KPI stats for any level

### Data Building Strategy
1. Fetch all active employees at target level
2. Get attendance rows for the day
3. Filter rows to match employee IDs at that level
4. Calculate stats from filtered rows
5. Serialize and return response

---

## Performance Considerations

- Prefetch related objects to minimize DB queries
- Attendance rows are computed once per request
- Stats calculation is efficient with pre-filtered employee sets
- Large tables may need pagination in future (consider for many employees)
