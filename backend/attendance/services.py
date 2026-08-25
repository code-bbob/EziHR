from __future__ import annotations

from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from enterprise.models import Employee
from device.models import BiometricDevice, EmployeeBiometricMapping

from .models import AttendanceEvent, DailyAttendance
from .ssm import publish_event


EVENT_CODE_ALIASES = {
    '0': AttendanceEvent.CHECK_IN,
    'check-in': AttendanceEvent.CHECK_IN,
    'checkin': AttendanceEvent.CHECK_IN,
    '1': AttendanceEvent.CHECK_OUT,
    'check-out': AttendanceEvent.CHECK_OUT,
    'checkout': AttendanceEvent.CHECK_OUT,
    '2': AttendanceEvent.BREAK_OUT,
    'break-out': AttendanceEvent.BREAK_OUT,
    'breakout': AttendanceEvent.BREAK_OUT,
    '3': AttendanceEvent.BREAK_IN,
    'break-in': AttendanceEvent.BREAK_IN,
    'breakin': AttendanceEvent.BREAK_IN,
    '4': AttendanceEvent.OT_IN,
    'ot-in': AttendanceEvent.OT_IN,
    'otin': AttendanceEvent.OT_IN,
    '5': AttendanceEvent.OT_OUT,
    'ot-out': AttendanceEvent.OT_OUT,
    'otout': AttendanceEvent.OT_OUT,
}


def _normalize_key(value: object) -> str:
    return str(value).strip().lower().replace(' ', '').replace('_', '-')


def parse_event_code(value: object) -> int | None:
    if value is None:
        return None
    normalized = _normalize_key(value)
    if normalized in EVENT_CODE_ALIASES:
        return EVENT_CODE_ALIASES[normalized]
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return number if number in {0, 1, 2, 3, 4, 5} else None


def parse_device_timestamp(value: object | None) -> datetime:
    if not value:
        return timezone.now()

    raw_value = str(value).strip()
    formats = (
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M:%S.%f',
        '%Y/%m/%d %H:%M:%S',
        '%Y/%m/%d %H:%M:%S.%f',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M:%S.%f',
    )
    for fmt in formats:
        try:
            parsed = datetime.strptime(raw_value, fmt)
        except ValueError:
            continue
        # Device sends local time in Asia/Kathmandu. Make it aware using server timezone.
        if timezone.is_naive(parsed):
            return timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    try:
        parsed = datetime.fromisoformat(raw_value)
    except ValueError:
        return timezone.now()
    # Assume naive ISO timestamps from device are in server's configured timezone.
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def register_biometric_device(
    serial_number: object | None,
    *,
    name: str | None = None,
    device_model: str | None = None,
    last_seen_at: datetime | None = None,
) -> BiometricDevice | None:
    if serial_number in (None, ''):
        return None

    normalized_serial = str(serial_number).strip()
    if not normalized_serial or normalized_serial.lower() == 'unknown':
        return None

    non_enterprise_defaults = {}
    if name is not None:
        non_enterprise_defaults['name'] = name
    if device_model is not None:
        non_enterprise_defaults['device_model'] = device_model
    if last_seen_at is not None:
        non_enterprise_defaults['last_seen_at'] = last_seen_at

    device, created = BiometricDevice.objects.update_or_create(
        serial_number=normalized_serial,
        defaults=non_enterprise_defaults,
    )

    return device


def resolve_employee(identifier: object | None, device_serial: object | None = None) -> Employee | None:
    if identifier in (None, ''):
        return None

    normalized = str(identifier).strip()
    if not normalized:
        return None

    device_enterprise_id = None
    if device_serial not in (None, ''):
        device_serial_normalized = str(device_serial).strip()
        if device_serial_normalized:
            try:
                device_obj = BiometricDevice.objects.get(serial_number=device_serial_normalized)
                device_enterprise_id = device_obj.enterprise_id
            except BiometricDevice.DoesNotExist:
                pass

            mapped_employee = (
                EmployeeBiometricMapping.objects.select_related('employee')
                .filter(device__serial_number=device_serial_normalized, device_user_id=normalized)
                .values_list('employee', flat=True)
                .first()
            )
            if mapped_employee:
                employee = Employee.objects.filter(id=mapped_employee).first()
                if employee:
                    return employee

    if device_enterprise_id is not None:
        employee = Employee.objects.filter(employee_code=normalized, enterprise_id=device_enterprise_id).first()
        if employee:
            return employee

    employee = Employee.objects.filter(employee_code=normalized).first()
    if employee:
        return employee
    return None


_NEXT_EVENT_MAP = {
    AttendanceEvent.CHECK_IN: AttendanceEvent.CHECK_OUT,
    AttendanceEvent.CHECK_OUT: AttendanceEvent.CHECK_IN,
    AttendanceEvent.BREAK_OUT: AttendanceEvent.BREAK_IN,
    AttendanceEvent.BREAK_IN: AttendanceEvent.BREAK_OUT,
    AttendanceEvent.OT_IN: AttendanceEvent.OT_OUT,
    AttendanceEvent.OT_OUT: AttendanceEvent.OT_IN,
}


def _last_event_of_day(employee: Employee, attendance_date) -> AttendanceEvent | None:
    return (
        AttendanceEvent.objects.filter(employee=employee, event_time__date=attendance_date)
        .order_by('event_time', 'id')
        .last()
    )


def _next_event_code(last_event_type: int) -> int:
    return _NEXT_EVENT_MAP.get(last_event_type, AttendanceEvent.CHECK_IN)


def infer_next_event_code(employee: Employee, event_time: datetime | None = None) -> int:
    event_time = event_time or timezone.now()

    last_event = _last_event_of_day(employee, timezone.localdate(event_time))
    if last_event is None:
        return AttendanceEvent.CHECK_IN
    return _next_event_code(last_event.event_type)


def resolve_normalized_event_code(
    employee: Employee,
    event_time: datetime | None = None,
    parsed_code: int | None = None,
) -> int:
    event_time = event_time or timezone.now()

    last_event = _last_event_of_day(employee, timezone.localdate(event_time))
    if last_event is None:
        return AttendanceEvent.CHECK_IN

    if parsed_code is None or parsed_code == last_event.event_type:
        return _next_event_code(last_event.event_type)

    return parsed_code


def _event_field_values(events, event_type: int) -> list[datetime]:
    return [event.event_time for event in events if event.event_type == event_type]


def _build_break_sessions(events) -> list[dict]:
    sessions: list[dict] = []
    active_break_start: datetime | None = None

    for event in events:
        if event.event_type == AttendanceEvent.BREAK_OUT:
            if active_break_start is not None:
                sessions.append({'break_out': active_break_start, 'break_in': None})
            active_break_start = event.event_time
        elif event.event_type == AttendanceEvent.BREAK_IN:
            if active_break_start is not None:
                sessions.append({'break_out': active_break_start, 'break_in': event.event_time})
                active_break_start = None
            else:
                sessions.append({'break_out': None, 'break_in': event.event_time})

    if active_break_start is not None:
        sessions.append({'break_out': active_break_start, 'break_in': None})

    return sessions


def _get_employee_schedule(employee: Employee):
    from datetime import time as _time

    arrival_time = getattr(employee, 'arrival_time', None)
    departure_time = getattr(employee, 'departure_time', None)
    department = getattr(employee, 'department', None)
    if arrival_time is None and department:
        arrival_time = getattr(department, 'arrival_time', None)
    if departure_time is None and department:
        departure_time = getattr(department, 'departure_time', None)
    return arrival_time or _time(hour=9, minute=0), departure_time or _time(hour=18, minute=0)


def _schedule_datetimes(employee: Employee, attendance_date):
    from datetime import datetime as _dt

    from django.utils import timezone as _tz

    arrival_time, departure_time = _get_employee_schedule(employee)
    arrival_dt = _dt.combine(attendance_date, arrival_time)
    departure_dt = _dt.combine(attendance_date, departure_time)
    if _tz.is_naive(arrival_dt):
        arrival_dt = _tz.make_aware(arrival_dt, _tz.get_current_timezone())
    if _tz.is_naive(departure_dt):
        departure_dt = _tz.make_aware(departure_dt, _tz.get_current_timezone())
    return arrival_dt, departure_dt


def _worked_minutes_from_events(events) -> int:
    check_in_times = _event_field_values(events, AttendanceEvent.CHECK_IN)
    if not check_in_times:
        return 0

    first_check_in = min(check_in_times)
    checkout_times = _event_field_values(events, AttendanceEvent.CHECK_OUT)
    ot_out_times = _event_field_values(events, AttendanceEvent.OT_OUT)
    end_time = max([*checkout_times, *ot_out_times], default=None)
    if end_time is None:
        end_time = timezone.now()

    worked = end_time - first_check_in
    if worked.total_seconds() < 0:
        return 0

    break_total = timedelta()
    active_break_start: datetime | None = None
    for event in events:
        if event.event_type == AttendanceEvent.BREAK_OUT:
            if active_break_start is None:
                active_break_start = event.event_time
        elif event.event_type == AttendanceEvent.BREAK_IN and active_break_start is not None:
            if event.event_time > active_break_start:
                break_total += event.event_time - active_break_start
            active_break_start = None

    if active_break_start is not None and end_time > active_break_start:
        break_total += end_time - active_break_start

    total_minutes = int((worked - break_total).total_seconds() // 60)
    return max(total_minutes, 0)


def rebuild_daily_attendance_summary(employee: Employee, attendance_date) -> DailyAttendance:
    events = list(
        AttendanceEvent.objects.filter(employee=employee, event_time__date=attendance_date).order_by('event_time', 'id')
    )

    summary, _ = DailyAttendance.objects.get_or_create(employee=employee, attendance_date=attendance_date)

    first_check_ins = _event_field_values(events, AttendanceEvent.CHECK_IN)
    check_outs = _event_field_values(events, AttendanceEvent.CHECK_OUT)
    ot_ins = _event_field_values(events, AttendanceEvent.OT_IN)
    ot_outs = _event_field_values(events, AttendanceEvent.OT_OUT)

    summary.first_check_in = min(first_check_ins) if first_check_ins else None
    summary.last_check_out = max(check_outs) if check_outs else None
    summary.first_ot_in = min(ot_ins) if ot_ins else None
    summary.last_ot_out = max(ot_outs) if ot_outs else None
    summary.present = bool(events)
    summary.worked_minutes = _worked_minutes_from_events(events)
    if events:
        summary.last_event_type = events[-1].event_type
        summary.last_event_time = events[-1].event_time
    # Ensure BS fields are populated based on the attendance_date
    try:
        from .date_utils import ad_to_bs

        y, m, d = ad_to_bs(summary.attendance_date)
        from datetime import date as _date

        summary.attendance_date_bs = _date(int(y), int(m), int(d))
    except Exception:
        # ignore conversion errors; leave defaults
        pass

    summary.save()
    return summary


@transaction.atomic
def record_device_event(
    employee: Employee,
    event_type: int,
    event_time: datetime | None = None,
    device_serial: str = '',
    raw_payload: dict | None = None,
    source: str = 'device',
) -> tuple[DailyAttendance, AttendanceEvent]:
    event_time = event_time or timezone.now()
    raw_payload = raw_payload or {}
    event = AttendanceEvent.objects.create(
        employee=employee,
        event_type=event_type,
        event_time=event_time,
        device_serial=device_serial,
        raw_payload=raw_payload,
        source=source,
    )
    if device_serial:
        BiometricDevice.objects.filter(serial_number=str(device_serial).strip()).update(last_seen_at=event_time)
    summary = rebuild_daily_attendance_summary(employee, timezone.localdate(event_time))
    # Best-effort publish to SSE clients so frontend can update in real-time.
    try:
        # Include summary fields so clients can update authoritative values
        publish_event({
            'event_id': event.id,
            'employee_id': employee.id,
            'employee_name': employee.name,
            'event_type': int(event_type),
            'event_time': event_time.isoformat(),
            'attendance_date': str(summary.attendance_date),
            'attendance_date_bs': str(summary.attendance_date_bs) if summary.attendance_date_bs else None,
            'first_check_in': summary.first_check_in.isoformat() if summary.first_check_in else None,
            'last_check_out': summary.last_check_out.isoformat() if summary.last_check_out else None,
            'worked_minutes': int(summary.worked_minutes or 0),
        })
    except Exception:
        # Never let SSE publishing break recording flow
        pass

    return summary, event


def build_dashboard_rows(attendance_date=None, branch_id=None, department_id=None, enterprise_id=None):
    attendance_date = attendance_date or timezone.localdate()
    employees = Employee.objects.filter(is_active=True)
    if enterprise_id:
        employees = employees.filter(enterprise_id=enterprise_id)
    if branch_id:
        employees = employees.filter(branch_id=branch_id)
    if department_id:
        employees = employees.filter(department_id=department_id)
    employees = employees.select_related('enterprise', 'branch', 'department', 'user').order_by('name', 'employee_code')
    employee_ids = list(employees.values_list('id', flat=True))

    summaries = {
        summary.employee_id: summary
        for summary in DailyAttendance.objects.filter(
            attendance_date=attendance_date,
            employee_id__in=employee_ids,
        ).select_related('employee', 'employee__department')
    }
    events_by_employee: dict[int, list[AttendanceEvent]] = {}
    for event in AttendanceEvent.objects.filter(
        employee_id__in=employee_ids,
        event_time__date=attendance_date,
    ).order_by('event_time', 'id'):
        events_by_employee.setdefault(event.employee_id, []).append(event)

    rows = []
    for employee in employees:
        summary = summaries.get(employee.id)
        employee_events = events_by_employee.get(employee.id, [])
        break_sessions = _build_break_sessions(employee_events)
        has_attendance = bool(
            summary
            and (
                summary.first_check_in is not None
                or summary.last_check_out is not None
                or summary.last_event_time is not None
            )
        )
        rows.append(
            {
                'employee': employee,
                'present': has_attendance,
                'check_in': summary.first_check_in if summary else None,
                'check_out': summary.last_check_out if summary else None,
                'break_sessions': break_sessions,
                'break_out': None,
                'break_in': None,
                'ot_in': summary.first_ot_in if summary else None,
                'ot_out': summary.last_ot_out if summary else None,
                'worked_minutes': summary.worked_minutes if summary else 0,
                'worked_duration': summary.worked_duration if summary else timedelta(),
                'summary': summary,
            }
        )
    return rows


def get_filtered_employees_queryset(branch_id=None, department_id=None, enterprise_id=None):
    employees = Employee.objects.filter(is_active=True)
    if enterprise_id:
        employees = employees.filter(enterprise_id=enterprise_id)
    if branch_id:
        employees = employees.filter(branch_id=branch_id)
    if department_id:
        employees = employees.filter(department_id=department_id)
    return employees.order_by('name', 'employee_code')


def build_dashboard_rows_for_employees(employees, attendance_date=None):
    attendance_date = attendance_date or timezone.localdate()
    employees = list(employees)
    employee_ids = [employee.id for employee in employees]
    if not employee_ids:
        return []

    summaries = {
        summary.employee_id: summary
        for summary in DailyAttendance.objects.filter(
            attendance_date=attendance_date,
            employee_id__in=employee_ids,
        )
    }
    events_by_employee: dict[int, list[AttendanceEvent]] = {}
    for event in AttendanceEvent.objects.filter(
        employee_id__in=employee_ids,
        event_time__date=attendance_date,
    ).order_by('event_time', 'id'):
        events_by_employee.setdefault(event.employee_id, []).append(event)

    rows = []
    for employee in employees:
        summary = summaries.get(employee.id)
        employee_events = events_by_employee.get(employee.id, [])
        break_sessions = _build_break_sessions(employee_events)
        has_attendance = bool(
            summary
            and (
                summary.first_check_in is not None
                or summary.last_check_out is not None
                or summary.last_event_time is not None
            )
        )
        rows.append(
            {
                'employee': employee,
                'present': has_attendance,
                'check_in': summary.first_check_in if summary else None,
                'check_out': summary.last_check_out if summary else None,
                'break_sessions': break_sessions,
                'break_out': None,
                'break_in': None,
                'ot_in': summary.first_ot_in if summary else None,
                'ot_out': summary.last_ot_out if summary else None,
                'worked_minutes': summary.worked_minutes if summary else 0,
                'worked_duration': summary.worked_duration if summary else timedelta(),
                'summary': summary,
            }
        )
    return rows


def _employee_stat_payload(row: dict) -> dict:
    employee = row.get('employee')
    worked_minutes = int(row.get('worked_minutes') or 0)
    return {
        'employee': {
            'id': employee.id,
            'employee_code': employee.employee_code,
            'name': employee.name,
        } if employee else None,
        'worked_minutes': worked_minutes,
        'worked_hours': round(worked_minutes / 60, 2),
    }


def build_dashboard_stats(attendance_rows: list[dict]) -> dict:
    total_employees = len(attendance_rows)
    present_today = sum(1 for row in attendance_rows if row.get('present'))
    absent_today = max(total_employees - present_today, 0)

    total_worked_minutes = sum(int(row.get('worked_minutes') or 0) for row in attendance_rows)
    avg_worked_minutes = int(round(total_worked_minutes / total_employees)) if total_employees else 0

    rows_with_attendance = [row for row in attendance_rows if row.get('present')]
    highest_row = max(rows_with_attendance, key=lambda row: int(row.get('worked_minutes') or 0), default=None)
    lowest_row = min(rows_with_attendance, key=lambda row: int(row.get('worked_minutes') or 0), default=None)

    return {
        'total_employees': total_employees,
        'present_today': present_today,
        'absent_today': absent_today,
        'average_worked_minutes': avg_worked_minutes,
        'average_worked_hours': round(avg_worked_minutes / 60, 2),
        'highest_working_time': _employee_stat_payload(highest_row) if highest_row else None,
        'lowest_working_time': _employee_stat_payload(lowest_row) if lowest_row else None,
    }


def build_dashboard_stats_fast(attendance_date=None, branch_id=None, department_id=None, enterprise_id=None) -> dict:
    attendance_date = attendance_date or timezone.localdate()
    employees = get_filtered_employees_queryset(
        branch_id=branch_id,
        department_id=department_id,
        enterprise_id=enterprise_id,
    )
    total_employees = employees.count()
    if total_employees == 0:
        return {
            'total_employees': 0,
            'present_today': 0,
            'absent_today': 0,
            'average_worked_minutes': 0,
            'average_worked_hours': 0.0,
            'highest_working_time': None,
            'lowest_working_time': None,
        }

    summaries = DailyAttendance.objects.filter(
        attendance_date=attendance_date,
        employee_id__in=employees.values('id'),
    )
    present_filter = (
        Q(first_check_in__isnull=False)
        | Q(last_check_out__isnull=False)
        | Q(last_event_time__isnull=False)
    )
    present_summaries = summaries.filter(present_filter)
    present_today = present_summaries.count()
    absent_today = max(total_employees - present_today, 0)

    total_worked_minutes = int(summaries.aggregate(total=Sum('worked_minutes')).get('total') or 0)
    avg_worked_minutes = int(round(total_worked_minutes / total_employees)) if total_employees else 0

    highest_summary = present_summaries.select_related('employee').order_by('-worked_minutes', 'employee_id').first()
    lowest_summary = present_summaries.select_related('employee').order_by('worked_minutes', 'employee_id').first()

    def _summary_stat_payload(summary):
        if not summary or not summary.employee:
            return None
        worked_minutes = int(summary.worked_minutes or 0)
        return {
            'employee': {
                'id': summary.employee.id,
                'employee_code': summary.employee.employee_code,
                'name': summary.employee.name,
            },
            'worked_minutes': worked_minutes,
            'worked_hours': round(worked_minutes / 60, 2),
        }

    return {
        'total_employees': total_employees,
        'present_today': present_today,
        'absent_today': absent_today,
        'average_worked_minutes': avg_worked_minutes,
        'average_worked_hours': round(avg_worked_minutes / 60, 2),
        'highest_working_time': _summary_stat_payload(highest_summary),
        'lowest_working_time': _summary_stat_payload(lowest_summary),
    }


def _compute_late_arrival_seconds(summary: DailyAttendance) -> int:
    """Calculate seconds late for a given attendance summary.
    
    Returns 0 if employee arrived on time or early, otherwise returns seconds after scheduled arrival.
    """
    if not summary or not summary.first_check_in:
        return 0

    scheduled_arrival, _ = _schedule_datetimes(summary.employee, summary.attendance_date)
    if summary.first_check_in <= scheduled_arrival:
        return 0
    
    return int((summary.first_check_in - scheduled_arrival).total_seconds())


def _compute_early_departure_seconds(summary: DailyAttendance) -> int:
    """Calculate seconds early for a given attendance summary.
    
    Returns 0 if employee departed on time or late, otherwise returns seconds before scheduled departure.
    """
    if not summary or not summary.last_check_out:
        return 0

    _, scheduled_departure = _schedule_datetimes(summary.employee, summary.attendance_date)
    if summary.last_check_out >= scheduled_departure:
        return 0
    
    return int((scheduled_departure - summary.last_check_out).total_seconds())


def get_late_arrivals(attendance_date=None, branch_id=None, department_id=None, enterprise_id=None) -> list[dict]:
    """Fetch employees who arrived late on a given day, with optional branch/department filter.
    
    Args:
        attendance_date: Date to check (default today)
        branch_id: Filter by branch ID (optional)
        department_id: Filter by department ID (optional)
    
    Returns:
        List of dicts with employee, check_in time, scheduled arrival, and late_seconds.
    """
    attendance_date = attendance_date or timezone.localdate()
    
    # Get all daily attendance records for the date
    summaries = DailyAttendance.objects.filter(
        attendance_date=attendance_date,
        first_check_in__isnull=False,  # Must have checked in
    ).select_related('employee', 'employee__department')
    
    # Apply filters
    if branch_id:
        summaries = summaries.filter(employee__branch_id=branch_id)
    if department_id:
        summaries = summaries.filter(employee__department_id=department_id)
    if enterprise_id:
        summaries = summaries.filter(employee__enterprise_id=enterprise_id)
    
    late_arrivals = []
    for summary in summaries:
        late_seconds = _compute_late_arrival_seconds(summary)
        if late_seconds > 0:
            scheduled_arrival, _ = _schedule_datetimes(summary.employee, summary.attendance_date)
            
            late_arrivals.append({
                'employee': summary.employee,
                'check_in': summary.first_check_in,
                'scheduled_arrival': scheduled_arrival,
                'late_seconds': late_seconds,
                'late_minutes': round(late_seconds / 60, 1),
                'summary': summary,
            })
    
    # Sort by late_seconds descending
    late_arrivals.sort(key=lambda x: x['late_seconds'], reverse=True)
    return late_arrivals


def get_early_departures(attendance_date=None, branch_id=None, department_id=None, enterprise_id=None) -> list[dict]:
    """Fetch employees who left early on a given day, with optional branch/department filter.
    
    Args:
        attendance_date: Date to check (default today)
        branch_id: Filter by branch ID (optional)
        department_id: Filter by department ID (optional)
    
    Returns:
        List of dicts with employee, check_out time, scheduled departure, and early_seconds.
    """
    attendance_date = attendance_date or timezone.localdate()
    
    # Get all daily attendance records for the date
    summaries = DailyAttendance.objects.filter(
        attendance_date=attendance_date,
        last_check_out__isnull=False,  # Must have checked out
    ).select_related('employee', 'employee__department')
    
    # Apply filters
    if branch_id:
        summaries = summaries.filter(employee__branch_id=branch_id)
    if department_id:
        summaries = summaries.filter(employee__department_id=department_id)
    if enterprise_id:
        summaries = summaries.filter(employee__enterprise_id=enterprise_id)
    
    early_departures = []
    for summary in summaries:
        early_seconds = _compute_early_departure_seconds(summary)
        if early_seconds > 0:
            _, scheduled_departure = _schedule_datetimes(summary.employee, summary.attendance_date)
            
            early_departures.append({
                'employee': summary.employee,
                'check_out': summary.last_check_out,
                'scheduled_departure': scheduled_departure,
                'early_seconds': early_seconds,
                'early_minutes': round(early_seconds / 60, 1),
                'summary': summary,
            })
    
    # Sort by early_seconds descending
    early_departures.sort(key=lambda x: x['early_seconds'], reverse=True)
    return early_departures
