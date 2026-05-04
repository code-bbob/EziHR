# Data Model & Relationships

## Entity Relationship Diagram

```
┌──────────────────────┐
│   Enterprise         │
│  ─────────────────  │
│  • id (PK)          │
│  • name             │
│  • address          │
│  • contact_email    │
│  • contact_phone    │
│  • licensed         │
│  • licensed_until   │
└──────────────────────┘
         │ 1
         │
         ├─────────────────────────────────────┐
         │                                     │
         │ 1                              1    │
         ▼                                     ▼
┌──────────────────────┐            ┌──────────────────────┐
│      Branch          │            │    Department        │
│  ─────────────────  │            │  ─────────────────  │
│  • id (PK)          │◄───┐       │  • id (PK)          │
│  • enterprise_id (FK)    │       │  • enterprise_id (FK)│
│  • name             │    │       │  • branch_id (FK)*  │
│  • address          │    │       │  • name             │
│  • contact_email    │    │       │  • created_at       │
│  • contact_phone    │    └───────┼───────────────────  │
│  • created_at       │            └──────────────────────┘
└──────────────────────┘                     │
         │ 1                                  │ 1
         │                                    │
         └────────────┬──────────────────────┘
                      │ 1
                      │
                      ▼
         ┌──────────────────────┐
         │    Employee          │
         │  ─────────────────  │
         │  • id (PK)          │
         │  • employee_code    │
         │  • name             │
         │  • avatar           │
         │  • enterprise_id (FK)
         │  • branch_id (FK)*  │
         │  • department_id(FK)│
         │  • user_id (FK)*    │
         │  • role             │
         │  • is_active        │
         │  • created_at       │
         └──────────────────────┘
                      │
                      │ Many
                      │
                      ▼
         ┌──────────────────────┐
         │  DailyAttendance     │
         │  ─────────────────  │
         │  • id (PK)          │
         │  • employee_id (FK) │
         │  • attendance_date  │
         │  • check_in         │
         │  • check_out        │
         │  • break_in         │
         │  • break_out        │
         │  • ot_in            │
         │  • ot_out           │
         │  • worked_minutes   │
         │  • present          │
         │  • created_at       │
         └──────────────────────┘

* Nullable foreign keys
FK = Foreign Key
PK = Primary Key
```

---

## Key Relationships

### Enterprise → Branch (1:Many)
- One enterprise has many branches
- Each branch belongs to exactly one enterprise
- Used for organizing employees geographically

### Enterprise → Department (1:Many)
- One enterprise has many departments
- Each department belongs to exactly one enterprise
- Departments can optionally be under a branch

### Branch → Department (1:Many)
- One branch has many departments
- Department.branch_id is nullable (allows root departments)
- Departments under a branch belong to that branch

### Department → Employee (1:Many)
- One department has many employees
- Each active employee belongs to exactly one department
- Employee.department_id is nullable (but typically set)

### Employee → DailyAttendance (1:Many)
- One employee has many attendance records
- Each day creates one attendance record
- Tracks check-in, check-out, breaks, overtime

### Employee → User (1:1)
- One employee links to exactly one system user
- User.employee_id is nullable (not all users are employees)
- Used for authentication and account management

---

## Hierarchical Data Structure

### Full Organization Hierarchy

```
Enterprise (e.g., "ACME Corporation")
├── Branch A (e.g., "New York Office")
│   ├── Department A1 (e.g., "Engineering")
│   │   ├── Employee 1
│   │   ├── Employee 2
│   │   └── Employee 3
│   │
│   └── Department A2 (e.g., "Sales")
│       ├── Employee 4
│       └── Employee 5
│
├── Branch B (e.g., "Los Angeles Office")
│   ├── Department B1 (e.g., "Support")
│   │   ├── Employee 6
│   │   └── Employee 7
│   │
│   └── Department B2 (e.g., "HR")
│       └── Employee 8
│
└── Department ROOT (e.g., "Executive", no branch assigned)
    ├── Employee 9
    └── Employee 10
```

### Attendance Tracking Hierarchy

```
Employee (e.g., "John Doe")
├── Daily Attendance for 2026-04-30
│   ├── Check-in: 09:00 AM
│   ├── Break-out: 12:00 PM
│   ├── Break-in: 1:00 PM
│   ├── Check-out: 5:30 PM
│   ├── Overtime-in: null
│   ├── Overtime-out: null
│   ├── Worked minutes: 480
│   └── Present: true
│
└── Daily Attendance for 2026-04-29
    ├── Check-in: 09:15 AM
    ├── Check-out: 5:00 PM
    ├── Worked minutes: 470
    └── Present: true
```

---

## Data Flow in Hierarchical Dashboard

### Level 1: Enterprise View
```
Database Query:
1. Get Enterprise for current user
2. Get all Branches for that Enterprise
3. Get all root Departments (branch_id = null) for that Enterprise
4. For each Branch/Department:
   - Get all Employees
   - Get their DailyAttendance for today
   - Calculate stats

Frontend Display:
- Enterprise Name
- Enterprise-wide stats (sum of all employees)
- List of Branches with branch-level stats
- List of Root Departments with department-level stats
```

### Level 2: Branch View
```
Database Query:
1. Get specific Branch
2. Get all Departments in that Branch
3. Get all Employees in that Branch
4. Get their DailyAttendance for today
5. Calculate stats

Frontend Display:
- Branch Name
- Branch-level stats
- List of Departments in branch (summarized)
- Table of all employees in branch (full details)
```

### Level 3: Department View
```
Database Query:
1. Get specific Department
2. Get all Employees in that Department
3. Get their DailyAttendance for today
4. Calculate full attendance details

Frontend Display:
- Department Name
- Department-level stats
- Table of all employees with full attendance details
  (check-in, check-out, breaks, overtime, hours worked)
```

---

## Stats Calculation

### Available Metrics (calculated from DailyAttendance)

```python
{
  "total_employees": int,           # Count of active employees
  "present_today": int,             # Count where present=true
  "absent_today": int,              # Count where present=false
  "average_worked_minutes": float,  # Mean of worked_minutes
  "average_worked_hours": float,    # average_worked_minutes / 60
  "highest_working_time": {         # Employee with max worked_minutes
    "employee": {
      "id": int,
      "employee_code": str,
      "name": str
    },
    "worked_minutes": int,
    "worked_hours": float
  },
  "lowest_working_time": {          # Employee with min worked_minutes
    "employee": {
      "id": int,
      "employee_code": str,
      "name": str
    },
    "worked_minutes": int,
    "worked_hours": float
  }
}
```

---

## Data Filtering Strategy

### Enterprise-level View
Filters: ALL active employees in enterprise
```python
employees = Employee.objects.filter(
    enterprise=enterprise,
    is_active=True
)
```

### Branch-level View
Filters: ALL active employees in branch (regardless of department)
```python
employees = Employee.objects.filter(
    branch=branch,
    is_active=True
)
```

### Department-level View
Filters: ALL active employees in department
```python
employees = Employee.objects.filter(
    department=department,
    is_active=True
)
```

### Attendance Row Filtering
Each level filters the master attendance_rows list by employee IDs:
```python
attendance_rows = build_dashboard_rows()  # All employees for today
filtered_rows = [
    row for row in attendance_rows
    if row.get('employee') and row.get('employee').id in emp_ids
]
stats = build_dashboard_stats(filtered_rows)
```

---

## Important Notes

### Nullable Fields
- `Branch.enterprise_id` - Required, never null (every branch must belong to an enterprise)
- `Department.branch_id` - NULLABLE (departments can exist without a branch - root level)
- `Employee.branch_id` - NULLABLE (employees don't need to be in a branch if department is root)
- `Employee.department_id` - NULLABLE (though typically set)
- `Employee.user_id` - NULLABLE (not all employees are system users)

### Active Status
- Only `Employee.is_active = true` employees are counted
- Inactive employees are excluded from all dashboard views
- Useful for archiving employees without deleting data

### Date Scope
- Dashboard shows data for TODAY (current date via `timezone.localdate()`)
- Attendance rows are fetched for the specific date
- Future: Can be extended to show historical data with date range filter

---

## Database Queries Used

### Hierarchical Dashboard Loading

```sql
-- Enterprise view: Get enterprise with related data
SELECT * FROM enterprise
WHERE id = <user_enterprise_id>

-- Get branches for enterprise
SELECT * FROM branch
WHERE enterprise_id = <enterprise_id>

-- Get departments for enterprise (root ones)
SELECT * FROM department
WHERE enterprise_id = <enterprise_id> AND branch_id IS NULL

-- Get employees for stats
SELECT * FROM employee
WHERE enterprise_id = <enterprise_id> AND is_active = TRUE

-- Get attendance for those employees today
SELECT * FROM attendance_dailyattendance
WHERE employee_id IN (...) AND attendance_date = TODAY()

-- Branch view: Get specific branch
SELECT * FROM branch WHERE id = <branch_id>

-- Get departments in branch
SELECT * FROM department
WHERE branch_id = <branch_id>

-- Get employees in branch
SELECT * FROM employee
WHERE branch_id = <branch_id> AND is_active = TRUE

-- Get their attendance
SELECT * FROM attendance_dailyattendance
WHERE employee_id IN (...) AND attendance_date = TODAY()
```

---

## Performance Optimization

### Current Implementation
- Uses `prefetch_related()` for related objects
- Filters at database level (not in Python)
- Single attendance_rows query, then filters in-memory
- Efficient for typical enterprise sizes (< 5000 employees)

### Future Optimizations
- Add database indexes on `(enterprise_id, is_active)`
- Add indexes on `(branch_id, is_active)` and `(department_id, is_active)`
- Cache stats for repeated requests
- Add pagination for employee tables (50-100 per page)
- Materialized views for common queries
