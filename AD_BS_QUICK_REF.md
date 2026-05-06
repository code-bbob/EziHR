# AD/BS Dates - Quick Reference Guide

## Quick Start

### For Backend Developers

#### Convert dates in Python:
```python
from attendance.date_utils import ad_to_bs, bs_to_ad
from datetime import date

# AD to BS
bs_year, bs_month, bs_day = ad_to_bs(date(2026, 5, 5))
print(f"{bs_year}-{bs_month:02d}-{bs_day:02d}")  # Output: 2083-01-21

# BS to AD
ad_date = bs_to_ad(2083, 1, 21)
print(ad_date)  # Output: 2026-05-05
```

#### Query attendance by BS month:
```python
# In your API view:
start_date, end_date, meta = _resolve_report_range(request)
# Pass date_format in query params: ?year=2083&month=1&date_format=bs
```

#### Update employee date preference:
```python
employee = Employee.objects.get(id=1)
employee.date_format_preference = 'bs'
employee.save()
```

---

### For Frontend Developers

#### Display dates in user's format:
```tsx
import { DateDisplay } from '@/components/DateDisplay';

<DateDisplay dateStr="2026-05-05" />
// Shows: 2026-05-05 or 2083-01-21 depending on user preference
```

#### Show both formats:
```tsx
<DateDisplay dateStr="2026-05-05" showBoth={true} />
// Shows: 2083-01-21 (BS) with both dates in tooltip
```

#### Convert dates in JavaScript:
```typescript
import { adToBS, bsToAD, formatBSDate } from '@/lib/date-utils';

const date = new Date(2026, 4, 5); // May 5, 2026
const bs = adToBS(date);
console.log(formatBSDate(bs.year, bs.month, bs.day)); // 2083-01-21
```

#### Get user's date preference:
```tsx
import { useDateFormatPreference } from '@/hooks/use-date-format';

const { dateFormat, updatePreference } = useDateFormatPreference();

// dateFormat is 'ad' or 'bs'
// updatePreference('bs') to change it
```

#### Add settings control:
```tsx
import { DateFormatPreferences } from '@/components/DateFormatPreferences';

<DateFormatPreferences />
// Renders full preference selector with UI
```

#### Filter by date with format support:
```tsx
import { AttendanceDateFilter } from '@/components/AttendanceDateFilter';

<AttendanceDateFilter
  onMonthChange={(year, month, format) => {
    apiClient.dashboard.getMonthlySummary({
      year,
      month,
      dateFormat: format,
    });
  }}
/>
```

---

## API Endpoints

### Get Attendance Dashboard
```
GET /attendance/api/daily/
```
Response includes `attendance_date_ad` and `attendance_date_bs`

### Monthly Summary (with date format support)
```
GET /attendance/api/reports/monthly-summary/
  ?year=2026&month=5&date_format=ad
  ?year=2083&month=1&date_format=bs
```

### Monthly Summary Detailed
```
GET /attendance/api/reports/monthly-summary-detailed/
  ?year=2026&month=5&date_format=ad
```

### Update Employee Preference
```
PUT /enterprise/api/employees/{id}/
{
  "date_format_preference": "bs"
}
```

---

## Key Data Structures

### Attendance Response
```json
{
  "attendance_date": "2026-05-05",
  "attendance_date_ad": "2026-05-05",
  "attendance_date_bs": "2083-01-21",
  "employee_code": "EMP001",
  "present": true
}
```

### Employee Response
```json
{
  "id": 1,
  "name": "John Doe",
  "date_format_preference": "bs",
  "employee_code": "EMP001"
}
```

---

## Common Tasks

### Display attendance table with dates
```tsx
import { DateDisplay } from '@/components/DateDisplay';

{attendance.map(record => (
  <tr key={record.id}>
    <td><DateDisplay dateStr={record.attendance_date} /></td>
    <td>{record.employee_code}</td>
    <td>{record.present ? 'Present' : 'Absent'}</td>
  </tr>
))}
```

### Show date with both formats
```tsx
<div>
  <p>AD: {record.attendance_date_ad}</p>
  <p>BS: {record.attendance_date_bs}</p>
</div>
```

### Filter by current month (auto-detect format)
```tsx
const today = new Date();
const { dateFormat } = useDateFormatPreference();
const year = dateFormat === 'bs' ? todayBS.year : today.getFullYear();
const month = dateFormat === 'bs' ? todayBS.month : today.getMonth() + 1;

apiClient.dashboard.getMonthlySummary({ year, month, dateFormat });
```

### Convert between formats
```typescript
import { adToBS, bsToAD, formatBSDate, formatADDate } from '@/lib/date-utils';

// Parse AD date
const adDate = new Date('2026-05-05');
const bs = adToBS(adDate);
const bsStr = formatBSDate(bs.year, bs.month, bs.day); // "2083-01-21"

// Parse BS date
const adDate2 = bsToAD(2083, 1, 21);
const adStr = formatADDate(adDate2); // "2026-05-05"
```

---

## Date Format Details

### AD (Gregorian)
- Used internationally
- Year: 2026 (current)
- Month: 1-12
- Day: 1-31
- Format: YYYY-MM-DD

### BS (Nepali/Bikram Sambat)
- Used in Nepal
- Year: 2083 (current in BS)
- Month: 1-12 (Baishakh to Chaitra)
- Day: 1-32 (varies by month)
- Format: YYYY-MM-DD
- ~57 years ahead of AD

---

## Troubleshooting

### Dates not updating after changing preference?
```typescript
// Force refresh from localStorage
import { getDateFormatPreference } from '@/hooks/use-date-format';
const format = getDateFormatPreference();
```

### Wrong date conversion?
- Check NEPALI_MONTH_DAYS table covers target year
- Current range: 2000-2033 BS
- Fallback to day 30 if year not in table

### API returning both date formats?
- All attendance endpoints always return both
- Use your preference to select which to display
- Backward compatible - existing code still works

---

## Testing Examples

```python
# Backend test
from attendance.date_utils import ad_to_bs, bsToAD
assert ad_to_bs(date(2026, 5, 5)) == (2083, 1, 21)
assert bs_to_ad(2083, 1, 21) == date(2026, 5, 5)
```

```typescript
// Frontend test
import { adToBS, bsToAD } from '@/lib/date-utils';
expect(adToBS(new Date(2026, 4, 5))).toEqual({ 
  year: 2083, month: 1, day: 21 
});
```

---

## Performance Notes

- ✅ Conversions are O(1) for most operations
- ✅ No API calls for date conversions
- ✅ Preference cached in localStorage
- ✅ Serialization includes both formats (minimal overhead)

---

## Support

For questions or issues:
1. Check IMPLEMENTATION_AD_BS_DATES.md for detailed docs
2. Review date-utils.ts for conversion logic
3. Check API test examples in your IDE
