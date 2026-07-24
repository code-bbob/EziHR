# EziHR Codebase Exploration - Findings Report

## 1. Current Date Filter Implementation (AD/BS Dates)

### Primary Date Utilities
- **File**: [frontend/lib/date-utils.ts](frontend/lib/date-utils.ts)
  - **Functions**:
    - `adToBS(date: Date)` - Converts Gregorian date to Nepali calendar
    - `bsToAD(year, month, day)` - Converts Nepali date to Gregorian
    - `formatADDate(date, format)` - Formats AD dates (supports YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY)
    - `formatBSDate(year, month, day, format)` - Formats BS dates
    - `getFormattedDate(dateStr, preference)` - Returns both AD and BS formats
    - `getTodayDates()` - Returns today in both AD and BS
  - **Epoch Reference**: April 14, 1943 (Nepali epoch)
  - **Nepali Calendar Data**: Lookup table for 2000-2033 with days per month
  - **Status**: ✅ Fully implemented and functional

### Date Filter Components
- **File**: [frontend/components/AttendanceDateFilter.tsx](frontend/components/AttendanceDateFilter.tsx)
  - **Props**:
    - `mode` - 'single' or 'range' date selection
    - `initialDateFormat` - Default format (ad/bs)
    - `initialDate/initialStartDate/initialEndDate` - Initial values
    - `onApply` callback with payload: `{ dateFormat, startDate, endDate }`
  - **Features**:
    - Switches between AD and BS calendars
    - Synchronized date selection across formats
    - Stores preference in localStorage as fallback
  - **Related Files**:
    - [frontend/lib/calendar-sync.ts](frontend/lib/calendar-sync.ts) - Date conversion and selection sync
    - [frontend/components/ad-calendar.tsx](frontend/components/ad-calendar.tsx) - Gregorian calendar UI
    - [frontend/components/nepali-bs-calendar.tsx](frontend/components/nepali-bs-calendar.tsx) - Nepali calendar UI

---

## 2. Enterprise Model and Preference Storage

### Enterprise Model Structure
- **File**: [backend/enterprise/models.py](backend/enterprise/models.py)

#### Enterprise
```
- id (auto)
- name (CharField)
- address (TextField)
- contact_email (EmailField)
- contact_phone (CharField)
- created_at (DateTimeField)
- licensed (BooleanField)
- licensed_until (DateField)
- max_alowed_employees (PositiveIntegerField)
```

#### Branch
```
- id (auto)
- enterprise (ForeignKey → Enterprise)
- name (CharField)
- address (TextField)
- contact_email (EmailField)
- contact_phone (CharField)
- created_at (DateTimeField)
```

#### Department
```
- id (auto)
- enterprise (ForeignKey → Enterprise)
- branch (ForeignKey → Branch)
- name (CharField)
- arrival_time (TimeField, default 9:00 AM)
- departure_time (TimeField, default 6:00 PM)
- created_at (DateTimeField)
```

#### Employee
```
- id (auto)
- employee_code (CharField)
- name (CharField)
- avatar (ImageField)
- enterprise (ForeignKey → Enterprise)
- branch (ForeignKey → Branch)
- department (ForeignKey → Department)
- arrival_time (TimeField)
- departure_time (TimeField)
- user (OneToOneField → User)
- email (EmailField)
- address (CharField)
- phone (CharField)
- dob (DateField)
- role (CharField: 'admin' or 'employee')
- is_active (BooleanField)
- created_at (DateTimeField)
```

**⚠️ NOTE**: The `date_format_preference` field is **NOT currently defined** in the Employee model, though the frontend code expects it.

### Preference Storage System
- **Hook**: [frontend/hooks/use-date-format.ts](frontend/hooks/use-date-format.ts)
  - `useDateFormatPreference()` - Async hook that:
    - Fetches current user's employee profile
    - Reads `date_format_preference` field (expected but missing)
    - Falls back to 'ad' if not found
    - Has `updatePreference(newFormat)` method to save
  - `getDateFormatPreference()` - Sync function using localStorage fallback
  - `setDateFormatPreference(format)` - Stores in localStorage
  
- **Component**: [frontend/components/DateFormatPreferences.tsx](frontend/components/DateFormatPreferences.tsx)
  - UI form for users to select AD (Gregorian) or BS (Nepali) format
  - Saves preference via `apiClient.employees.update(id, { date_format_preference })`
  - Shows formatted examples for each format

- **Serializer**: [backend/enterprise/serializers.py](backend/enterprise/serializers.py)
  - **Status**: Does NOT currently expose `date_format_preference` field
  - Employee serializer needs update to include this field

---

## 3. Date Conversion Libraries and Utilities

### Frontend Date Libraries
1. **bs-ad-calendar-react** (External Package)
   - Provides calendar calculations
   - Used by both AD and BS calendar components
   - Functions: `getTodayDate()`, `getDaysInMonth()`, `getFirstDayOfMonth()`

2. **date-utils.ts** (Custom Implementation)
   - Complete AD ↔ BS conversion logic
   - Nepali month calendar data (2000-2033)
   - Date formatting utilities
   - **Status**: ✅ Ready for production use

### Backend Date Utilities
- **File**: [backend/attendance/date_utils.py](backend/attendance/date_utils.py) (Expected)
  - **Note**: File not found in current scan - may need verification
  - Backend views reference: `from .date_utils import ad_to_bs, format_bs_date`
  - Used in `_format_ad_bs()` helper in views.py

---

## 4. How Attendance Pages and Reports Handle Dates

### Attendance Pages Using Filters

#### Daily Attendance
- **File**: [frontend/app/attendance/page.tsx](frontend/app/attendance/page.tsx)
- Uses: `getDateFormatPreference()` to load user's preferred format
- Features: SSE streaming for real-time attendance updates
- Date handling: Filters by `attendanceDate` and format

#### Late Arrivals Report
- **File**: [frontend/app/attendance/reports/late-arrivals/page.tsx](frontend/app/attendance/reports/late-arrivals/page.tsx)
- Uses: `AttendanceDateFilter` with **single date mode**
- State: `attendanceDate`, `dateFormat`
- API Call: `apiClient.dashboard.getLateArrivals(branchId, deptId, date, format)`

#### Early Departures Report
- **File**: [frontend/app/attendance/reports/early-departures/page.tsx](frontend/app/attendance/reports/early-departures/page.tsx)
- Similar structure to Late Arrivals

#### Monthly Summary Reports
- **Files**: 
  - [frontend/app/attendance/reports/monthly-summary/page.tsx](frontend/app/attendance/reports/monthly-summary/page.tsx)
  - [frontend/app/attendance/reports/monthly-summary-detailed/page.tsx](frontend/app/attendance/reports/monthly-summary-detailed/page.tsx)

### Report Navigation
- **File**: [frontend/components/attendance-report-tabs.tsx](frontend/components/attendance-report-tabs.tsx)
- Tab-based navigation between:
  - Daily Attendance
  - Late Arrivals
  - Early Departures
  - Monthly Summary
  - Detailed Monthly Summary

### Backend API Date Handling
- **File**: [backend/attendance/views.py](backend/attendance/views.py)
- **Key Function**: `_get_requested_date_format(request)` - Detects format from query params
  - Checks for `dateFormat` or `date_format` query param
  - Returns 'bs' if explicitly requested, 'ad' otherwise
  - Defaults to None if no date-related param supplied
  
- **Date Formatting Helper**: `_format_ad_bs(date_obj)` - Returns tuple (ad_str, bs_str)
  - Used to return both formats in API responses
  - Enables frontend to display in user's preferred format

- **Response Data**: Includes both AD and BS dates
  ```
  {
    "attendance_date": "2026-05-05",
    "attendance_date_ad": "2026-05-05",
    "attendance_date_bs": "2083-01-21"
  }
  ```

### Services
- **File**: [backend/attendance/services.py](backend/attendance/services.py)
- **Functions**:
  - `get_late_arrivals(attendance_date, branch_id, department_id, enterprise_id)`
  - `get_early_departures()` - Similar signature
  - `build_dashboard_rows()` - Builds attendance rows with date formatting
  - `build_dashboard_stats()` - Generates attendance statistics

---

## 5. Date Filter Usage Locations

### Hooks Using Date Filters
- [frontend/hooks/use-date-format.ts](frontend/hooks/use-date-format.ts)
  - `useDateFormatPreference()` - Main preference management hook
  - `getDateFormatPreference()` - Utility for accessing preference

- [frontend/hooks/useFilters.ts](frontend/hooks/useFilters.ts) (Expected)
  - State management for filters including dates

### Components Using Date Filters

#### Filter Component
- [frontend/components/AttendanceDateFilter.tsx](frontend/components/AttendanceDateFilter.tsx)
  - Renders full filter UI with calendar pickers
  - Handles AD/BS format switching
  - Calls `onApply` callback with selected dates

#### Calendar Components
- [frontend/components/ad-calendar.tsx](frontend/components/ad-calendar.tsx)
  - Gregorian calendar picker with month/year navigation
  - Shows date selection in format: `YYYY-MM-DD`

- [frontend/components/nepali-bs-calendar.tsx](frontend/components/nepali-bs-calendar.tsx)
  - Nepali calendar with Nepali month names
  - Shows dates in format: `YYYY-MM-DD` (BS years)
  - Converts digits to Nepali numerals for display

#### Utility Component
- [frontend/components/DateFormatPreferences.tsx](frontend/components/DateFormatPreferences.tsx)
  - Standalone preferences UI
  - Radio button selection between AD and BS
  - Save/Cancel buttons with validation

- [frontend/components/ui/calendar.tsx](frontend/components/ui/calendar.tsx)
  - Base calendar UI component (shadcn/ui)

#### Table Components
- [frontend/components/AttendanceTable.tsx](frontend/components/AttendanceTable.tsx)
  - Displays attendance rows with check-in/check-out times
  - Date filtering done at API level

- [frontend/components/attendance-report-tabs.tsx](frontend/components/attendance-report-tabs.tsx)
  - Navigation between report types

### Pages Using Filters (All in attendance subdirectories)
- `/attendance` - Main attendance page
- `/attendance/reports/late-arrivals` - Report with date filter
- `/attendance/reports/early-departures` - Report with date filter
- `/attendance/reports/monthly-summary` - Report with date selection
- `/attendance/reports/monthly-summary-detailed` - Report with date selection

### Report Export Utilities
- [frontend/lib/report-export.ts](frontend/lib/report-export.ts)
  - `getRangeDates(startDate, endDate, dateFormat)` - Generates date range
  - `buildCsv()` - CSV export
  - `downloadCsv()` - Triggers download
  - `triggerPrint()` - Print functionality

---

## 6. API Integration Points

### Date Format Query Parameters
Backend expects these query parameters:
- `dateFormat=ad` or `dateFormat=bs` - Explicit format declaration
- `date_format=ad` or `date_format=bs` - Alternative parameter name
- `attendance_date=YYYY-MM-DD` - Single date filter
- `start_date=YYYY-MM-DD` - Range start
- `end_date=YYYY-MM-DD` - Range end

### API Client Methods (Expected)
- `apiClient.dashboard.getLateArrivals(branchId, deptId, date, dateFormat)`
- `apiClient.dashboard.getEarlyDepartures(branchId, deptId, date, dateFormat)`
- `apiClient.employees.update(id, { date_format_preference })`

---

## Summary of Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| AD/BS Date Conversion | ✅ Complete | Fully functional in frontend, backend needs verification |
| Calendar Components | ✅ Complete | AD and BS calendars with sync |
| Date Filter UI | ✅ Complete | Single and range modes |
| Date Format Preference Hook | ✅ Complete | Functional but field missing from backend |
| Enterprise Model | ⚠️ Incomplete | Missing `date_format_preference` on Employee |
| Employee Serializer | ❌ Missing field | Needs update to expose preference |
| Backend Date Utils | 🔍 Unverified | Expected at `backend/attendance/date_utils.py` |
| Attendance Pages | ✅ Complete | All pages integrated with date filters |
| Report Export | ✅ Complete | CSV and range date generation |
| API Date Handling | ✅ Complete | Backend supports both formats |

---

## Key Files Reference

### Frontend
```
frontend/
├── lib/
│   ├── date-utils.ts              # AD/BS conversion algorithms
│   ├── calendar-sync.ts           # Date selection sync logic
│   ├── report-export.ts           # CSV export utilities
│   └── api-client.ts              # API client configuration
├── hooks/
│   ├── use-date-format.ts         # Date preference management
│   └── useFilters.ts              # Filter state management
└── components/
    ├── AttendanceDateFilter.tsx   # Main filter component
    ├── DateFormatPreferences.tsx  # Preference UI
    ├── ad-calendar.tsx            # Gregorian calendar
    ├── nepali-bs-calendar.tsx     # Nepali calendar
    ├── AttendanceTable.tsx        # Display component
    └── attendance-report-tabs.tsx # Report navigation
```

### Backend
```
backend/
├── enterprise/
│   ├── models.py                  # Enterprise, Branch, Department, Employee
│   └── serializers.py             # Model serializers (needs update)
├── attendance/
│   ├── views.py                   # API endpoints with date handling
│   ├── services.py                # Business logic (get_late_arrivals, etc.)
│   └── date_utils.py              # Date conversion utilities (verify)
└── app/
    ├── attendance/page.tsx        # Daily attendance view
    └── attendance/reports/        # Report pages
```
