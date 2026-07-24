from __future__ import annotations

from datetime import datetime, date, timedelta
from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import UnsupportedMediaType
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import BaseParser, MultiPartParser, FormParser, JSONParser
from django.http import StreamingHttpResponse
import json
from .ssm import subscribe, unsubscribe
from enterprise.permissions import IsAdminRole

from .services import (
    build_dashboard_rows,
    build_dashboard_stats,
    build_dashboard_rows_for_employees,
    build_dashboard_stats_fast,
    get_filtered_employees_queryset,
    infer_next_event_code,
    parse_device_timestamp,
    parse_event_code,
    register_biometric_device,
    record_device_event,
    resolve_employee,
    get_late_arrivals,
    get_early_departures,
)
from .serializers import DailyAttendanceSerializer
from .models import DailyAttendance, AttendanceEvent
from enterprise.models import Employee, Enterprise, Branch, Department
import calendar
from rest_framework import status
import logging

# Get an instance of a logger
logger = logging.getLogger(__name__)


class DefaultPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = None
    max_page_size = 30


def _resolve_user_enterprise(user):
    if hasattr(user, 'employee') and user.employee and user.employee.enterprise:
        return user.employee.enterprise
    if hasattr(user, 'profile') and user.profile and user.profile.enterprise:
        return user.profile.enterprise
    return None


def _parse_optional_int(value):
    if value in (None, ''):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _dt_iso(value):
    try:
        return value.isoformat() if value is not None else None
    except Exception:
        return None


def _format_ad_bs(a_date):
    """Return tuple (ad_str, bs_str) for a date object."""
    try:
        ad = str(a_date)
    except Exception:
        ad = None
    try:
        from .date_utils import ad_to_bs, format_bs_date

        y, m, d = ad_to_bs(a_date)
        bs = format_bs_date(y, m, d)
    except Exception:
        bs = None
    return ad, bs


def _get_requested_date_format(request: HttpRequest) -> str | None:
    """Return the date format the frontend indicated for the request.

    Returns 'bs' if the frontend sent `dateFormat=bs` (or `date_format=bs`),
    'ad' if the frontend provided a date but did not declare BS, or None if
    no date-related parameter was supplied.
    """
    df = request.query_params.get('dateFormat') or request.query_params.get('date_format')
    if df:
        return str(df).lower()

    # If a date filter was provided but no format flag, assume AD
    if any(k in request.query_params for k in ('attendance_date', 'start_date', 'end_date', 'year', 'month')):
        return 'ad'
    return None


def _serialize_employee_min(employee):
    if employee is None:
        return None
    return {
        'id': employee.id,
        'employee_code': employee.employee_code,
        'name': employee.name,
    }


def _serialize_summary_min(summary):
    if summary is None:
        return None

    worked_minutes = int(summary.worked_minutes or 0)
    return {
        'id': summary.id,
        'employee': summary.employee_id,
        'attendance_date': str(summary.attendance_date),
        'attendance_date_ad': getattr(summary, 'attendance_date_ad', str(summary.attendance_date)),
        'attendance_date_bs': str(getattr(summary, 'attendance_date_bs', None)) if getattr(summary, 'attendance_date_bs', None) else None,
        'first_check_in': _dt_iso(summary.first_check_in),
        'last_check_out': _dt_iso(summary.last_check_out),
        'worked_minutes': worked_minutes,
        'worked_hours': round(worked_minutes / 60, 2),
        'present': bool(summary.present),
        'last_event_type': summary.last_event_type,
        'last_event_time': _dt_iso(summary.last_event_time),
    }


def _serialize_attendance_row(row):
    employee = row.get('employee')
    summary = row.get('summary')
    emp_data = _serialize_employee_min(employee)
    summary_data = _serialize_summary_min(summary)

    return {
        'employee': emp_data,
        'present': bool(row.get('present', False)),
        'check_in': _dt_iso(row.get('check_in')),
        'check_out': _dt_iso(row.get('check_out')),
        'break_sessions': [
            {
                'break_out': _dt_iso(session.get('break_out')),
                'break_in': _dt_iso(session.get('break_in')),
            }
            for session in (row.get('break_sessions') or [])
        ],
        'ot_in': _dt_iso(row.get('ot_in')),
        'ot_out': _dt_iso(row.get('ot_out')),
        'worked_minutes': int(row.get('worked_minutes') or 0),
        'summary': summary_data,
        'late_seconds': int(summary_data.get('late_seconds') or 0) if isinstance(summary_data, dict) else 0,
        'early_seconds': int(summary_data.get('early_seconds') or 0) if isinstance(summary_data, dict) else 0,
        'late_duration': summary_data.get('late_duration') if isinstance(summary_data, dict) else None,
        'early_duration': summary_data.get('early_duration') if isinstance(summary_data, dict) else None,
        'scheduled_arrival': summary_data.get('scheduled_arrival') if isinstance(summary_data, dict) else None,
        'scheduled_departure': summary_data.get('scheduled_departure') if isinstance(summary_data, dict) else None,
    }


class DashboardAPIView(APIView):
    """API endpoint for attendance dashboard data

    Notes:
    - Requires authentication. Admins (is_staff) can see the full dashboard.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = DefaultPagination

    def get(self, request: HttpRequest):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=403)

        branch_id = _parse_optional_int(request.query_params.get('branch_id'))
        department_id = _parse_optional_int(request.query_params.get('department_id'))

        if request.query_params.get('branch_id') and branch_id is None:
            return Response({'error': 'Invalid branch_id'}, status=400)
        if request.query_params.get('department_id') and department_id is None:
            return Response({'error': 'Invalid department_id'}, status=400)

        if branch_id and not Branch.objects.filter(id=branch_id, enterprise=enterprise).exists():
            return Response({'error': 'Branch not found for your enterprise'}, status=404)
        if department_id and not Department.objects.filter(id=department_id, enterprise=enterprise).exists():
            return Response({'error': 'Department not found for your enterprise'}, status=404)

        paginator = self.pagination_class()
        employees = get_filtered_employees_queryset(
            branch_id=branch_id,
            department_id=department_id,
            enterprise_id=enterprise.id,
        ).select_related('enterprise', 'branch', 'department', 'user')
        page_employees = paginator.paginate_queryset(employees, request, view=self)
        page_rows = build_dashboard_rows_for_employees(
            page_employees,
            attendance_date=timezone.localdate(),
        )
        serialized_rows = [_serialize_attendance_row(row) for row in page_rows]
        return Response({
            'attendance_rows': serialized_rows,
            'attendance_date': str(timezone.localdate()),
            'attendance_date_ad': _format_ad_bs(timezone.localdate())[0],
            'attendance_date_bs': _format_ad_bs(timezone.localdate())[1],
            'stats': build_dashboard_stats_fast(
                attendance_date=timezone.localdate(),
                branch_id=branch_id,
                department_id=department_id,
                enterprise_id=enterprise.id,
            ),
            'pagination': {
                'count': paginator.page.paginator.count,
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'page': paginator.page.number,
                'page_size': self.pagination_class.page_size,
            },
        })


class AttendanceRowsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = DefaultPagination

    def get(self, request: HttpRequest):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=403)

        branch_id = _parse_optional_int(request.query_params.get('branch_id'))
        department_id = _parse_optional_int(request.query_params.get('department_id'))

        if request.query_params.get('branch_id') and branch_id is None:
            return Response({'error': 'Invalid branch_id'}, status=400)
        if request.query_params.get('department_id') and department_id is None:
            return Response({'error': 'Invalid department_id'}, status=400)

        if branch_id and not Branch.objects.filter(id=branch_id, enterprise=enterprise).exists():
            return Response({'error': 'Branch not found for your enterprise'}, status=404)
        if department_id and not Department.objects.filter(id=department_id, enterprise=enterprise).exists():
            return Response({'error': 'Department not found for your enterprise'}, status=404)

        date_format = request.query_params.get('date_format')
        attendance_date = _parse_date_param(
            request.query_params.get('attendance_date'),
            date_format=date_format,
        ) or timezone.localdate()

        paginator = self.pagination_class()
        employees = get_filtered_employees_queryset(
            branch_id=branch_id,
            department_id=department_id,
            enterprise_id=enterprise.id,
        ).select_related('enterprise', 'branch', 'department', 'user')
        page_employees = paginator.paginate_queryset(employees, request, view=self)
        page_rows = build_dashboard_rows_for_employees(
            page_employees,
            attendance_date=attendance_date,
        )
        serialized_rows = [_serialize_attendance_row(row) for row in page_rows]

        return Response({
            'attendance_rows': serialized_rows,
            'attendance_date': str(attendance_date),
            'attendance_date_ad': _format_ad_bs(attendance_date)[0],
            'attendance_date_bs': _format_ad_bs(attendance_date)[1],
            'count': paginator.page.paginator.count,
            'pagination': {
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'page': paginator.page.number,
                'page_size': self.pagination_class.page_size,
            },
        })


class DashboardStatsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request: HttpRequest):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=403)

        branch_id = _parse_optional_int(request.query_params.get('branch_id'))
        department_id = _parse_optional_int(request.query_params.get('department_id'))

        if request.query_params.get('branch_id') and branch_id is None:
            return Response({'error': 'Invalid branch_id'}, status=400)
        if request.query_params.get('department_id') and department_id is None:
            return Response({'error': 'Invalid department_id'}, status=400)

        if branch_id and not Branch.objects.filter(id=branch_id, enterprise=enterprise).exists():
            return Response({'error': 'Branch not found for your enterprise'}, status=404)
        if department_id and not Department.objects.filter(id=department_id, enterprise=enterprise).exists():
            return Response({'error': 'Department not found for your enterprise'}, status=404)

        date_format = request.query_params.get('date_format')
        attendance_date = _parse_date_param(
            request.query_params.get('attendance_date'),
            date_format=date_format,
        ) or timezone.localdate()

        stats = build_dashboard_stats_fast(
            attendance_date=attendance_date,
            branch_id=branch_id,
            department_id=department_id,
            enterprise_id=enterprise.id,
        )
        return Response({
            'attendance_date': str(attendance_date),
            'attendance_date_ad': _format_ad_bs(attendance_date)[0],
            'attendance_date_bs': _format_ad_bs(attendance_date)[1],
            'stats': stats,
        })


class HierarchicalDashboardAPIView(APIView):
    """Enterprise-level hierarchical dashboard with drill-down by branch and department"""
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = DefaultPagination

    def get(self, request: HttpRequest):
        enterprise = self._get_user_enterprise(request)
        if not enterprise:
            return Response({'error': 'No enterprise found for this user'}, status=403)

        attendance_date = timezone.localdate()
        cache_key = f'hierarchical_dashboard:{enterprise.id}:{attendance_date.isoformat()}'
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            return Response(cached_payload)

        dashboard_context = self._build_dashboard_context(enterprise, attendance_date)

        response_payload = {
            'enterprise': self._build_enterprise_view(enterprise, attendance_date, dashboard_context),
            'attendance_date': str(attendance_date),
            'attendance_date_ad': _format_ad_bs(attendance_date)[0],
            'attendance_date_bs': _format_ad_bs(attendance_date)[1],
        }
        cache.set(cache_key, response_payload, timeout=15)
        return Response(response_payload)

    def _get_user_enterprise(self, request):
        return _resolve_user_enterprise(request.user)

    def _build_dashboard_context(self, enterprise, attendance_date):
        employees = list(
            Employee.objects.filter(enterprise=enterprise, is_active=True)
            .select_related('enterprise', 'branch', 'department', 'user')
            .order_by('name', 'employee_code')
        )

        summaries = {
            summary.employee_id: summary
            for summary in DailyAttendance.objects.filter(
                attendance_date=attendance_date,
                employee__enterprise=enterprise,
            ).select_related('employee', 'employee__department')
        }

        rows = []
        rows_by_branch = {}
        rows_by_department = {}

        for employee in employees:
            summary = summaries.get(employee.id)
            has_attendance = bool(
                summary
                and (
                    summary.first_check_in is not None
                    or summary.last_check_out is not None
                    or summary.last_event_time is not None
                )
            )
            row = {
                'employee': employee,
                'present': has_attendance,
                'check_in': summary.first_check_in if summary else None,
                'check_out': summary.last_check_out if summary else None,
                'break_out': None,
                'break_in': None,
                'ot_in': summary.first_ot_in if summary else None,
                'ot_out': summary.last_ot_out if summary else None,
                'worked_minutes': summary.worked_minutes if summary else 0,
                'summary': summary,
            }
            rows.append(row)

            if employee.branch_id:
                rows_by_branch.setdefault(employee.branch_id, []).append(row)
            if employee.department_id:
                rows_by_department.setdefault(employee.department_id, []).append(row)

        return {
            'rows': rows,
            'rows_by_branch': rows_by_branch,
            'rows_by_department': rows_by_department,
        }

    def _paginate_rows(self, request, rows):
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(rows, request, view=self)
        return page, {
            'count': paginator.page.paginator.count,
            'next': paginator.get_next_link(),
            'previous': paginator.get_previous_link(),
            'page': paginator.page.number,
            'page_size': self.pagination_class.page_size,
        }

    def _build_enterprise_view(self, enterprise, attendance_date, dashboard_context):
        return {
            'id': enterprise.id,
            'name': enterprise.name,
            'stats': build_dashboard_stats(dashboard_context['rows']),
            'branches': [
                self._build_branch_view(branch, attendance_date, dashboard_context, summarize=True)
                for branch in enterprise.branches.all().prefetch_related('departments')
            ],
            'departments': [
                self._build_department_view(dept, attendance_date, dashboard_context, summarize=True)
                for dept in enterprise.departments.all()
            ],
        }

    def _build_branch_view(self, branch, attendance_date, dashboard_context, summarize=False, request=None):
        departments = branch.departments.all()
        branch_rows = dashboard_context['rows_by_branch'].get(branch.id, [])
        
        view = {
            'id': branch.id,
            'name': branch.name,
            'stats': build_dashboard_stats(branch_rows),
            'departments': [
                self._build_department_view(dept, attendance_date, dashboard_context, summarize=summarize)
                for dept in departments
            ],
        }
        
        if not summarize:
            if request is None:
                view['attendance_rows'] = [_serialize_attendance_row(row) for row in branch_rows]
            else:
                page_rows, pagination = self._paginate_rows(request, branch_rows)
                view['attendance_rows'] = [_serialize_attendance_row(row) for row in page_rows]
                view['attendance_pagination'] = pagination
        
        return view

    def _build_department_view(self, department, attendance_date, dashboard_context, summarize=False, request=None):
        dept_rows = dashboard_context['rows_by_department'].get(department.id, [])
        
        view = {
            'id': department.id,
            'name': department.name,
            'branch_id': department.branch.id if department.branch else None,
            'stats': build_dashboard_stats(dept_rows),
        }
        
        if not summarize:
            if request is None:
                view['attendance_rows'] = [_serialize_attendance_row(row) for row in dept_rows]
            else:
                page_rows, pagination = self._paginate_rows(request, dept_rows)
                view['attendance_rows'] = [_serialize_attendance_row(row) for row in page_rows]
                view['attendance_pagination'] = pagination

        return view


class BranchDashboardAPIView(APIView):
    """Detailed view of a specific branch with department summaries"""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request: HttpRequest, branch_id: int):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise found for this user'}, status=403)

        try:
            branch = Branch.objects.get(id=branch_id, enterprise=enterprise)
        except Branch.DoesNotExist:
            return Response({'error': 'Branch not found'}, status=404)

        attendance_date = timezone.localdate()
        view_builder = HierarchicalDashboardAPIView()
        dashboard_context = view_builder._build_dashboard_context(enterprise, attendance_date)
        
        return Response({
            'branch': view_builder._build_branch_view(
                branch,
                attendance_date,
                dashboard_context,
                summarize=False,
                request=request,
            ),
            'enterprise': {
                'id': branch.enterprise.id,
                'name': branch.enterprise.name,
                'branches': [
                    {'id': b.id, 'name': b.name} for b in branch.enterprise.branches.all()
                ]
            },
            'attendance_date': str(attendance_date),
            'attendance_date_ad': _format_ad_bs(attendance_date)[0],
            'attendance_date_bs': _format_ad_bs(attendance_date)[1],
        })


class DepartmentDashboardAPIView(APIView):
    """Detailed view of a specific department with full employee attendance"""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request: HttpRequest, department_id: int):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise found for this user'}, status=403)

        try:
            department = Department.objects.get(id=department_id, enterprise=enterprise)
        except Department.DoesNotExist:
            return Response({'error': 'Department not found'}, status=404)

        attendance_date = timezone.localdate()
        view_builder = HierarchicalDashboardAPIView()
        dashboard_context = view_builder._build_dashboard_context(enterprise, attendance_date)
        
        response_data = {
            'department': view_builder._build_department_view(
                department,
                attendance_date,
                dashboard_context,
                summarize=False,
                request=request,
            ),
            'enterprise': {
                'id': department.enterprise.id,
                'name': department.enterprise.name,
                'branches': [
                    {'id': b.id, 'name': b.name} for b in department.enterprise.branches.all()
                ]
            },
            'attendance_date': str(attendance_date),
            'attendance_date_ad': _format_ad_bs(attendance_date)[0],
            'attendance_date_bs': _format_ad_bs(attendance_date)[1],
        }
        
        if department.branch:
            response_data['branch'] = {
                'id': department.branch.id,
                'name': department.branch.name,
                'departments': [
                    {'id': d.id, 'name': d.name, 'branch_id': d.branch_id} for d in department.branch.departments.all()
                ]
            }
            
        return Response(response_data)


class PlainTextParser(BaseParser):
    """A very permissive parser that accepts any media type and returns
    the raw request body decoded as a string. This helps when devices send
    `text/plain`, no Content-Type, or other non-standard content types.
    """
    media_type = '*/*'

    def parse(self, stream, media_type=None, parser_context=None):
        data = stream.read()
        try:
            return data.decode('utf-8', errors='ignore')
        except Exception:
            return data


def _pick_value(payload: dict, keys: list[str], default=None):
    for key in keys:
        if key not in payload:
            continue
        value = payload[key]
        if isinstance(value, (list, tuple)):
            value = value[0] if value else None
        if value not in ('', None):
            return value
    return default


def _parse_iclock_row_format(raw_str: str) -> dict:
    """Parse iClock tab-separated row format.

    Common ATTLOG push format:
    PIN\tTIMESTAMP\tVERIFY\tSTATUS\tWORKCODE\tRES1\tRES2
    Example: 3\t2026-04-28 22:41:25\t0\t1\t\t0\t0

    We extract:
      - Field 0: employee identifier (PIN)
      - Field 1: timestamp
      - Field 2: verify/event code (0..5)
    """
    parts = [part.strip() for part in raw_str.split('\t')]
    if len(parts) < 2:
        return {}

    result = {}
    if parts[0].strip():
        result['PIN'] = parts[0].strip()
    if parts[1].strip():
        result['timestamp'] = parts[1].strip()

    if len(parts) > 2 and parts[2].strip():
        result['status'] = parts[2].strip()
    elif len(parts) > 3 and parts[3].strip():
        result['status'] = parts[3].strip()

    if 'status' not in result and parts[0] in {'0', '1', '2', '3', '4', '5'}:
        result['event_code'] = parts[0]

    return result


def _parse_iclock_rows(raw_body: str) -> list[dict]:
    rows: list[dict] = []
    for line in raw_body.splitlines():
        clean_line = line.strip()
        if not clean_line:
            continue
        parsed = _parse_iclock_row_format(clean_line)
        if parsed:
            rows.append(parsed)
    return rows


def _plain_text_response(message: str) -> HttpResponse:
    return HttpResponse(message, content_type='text/plain; charset=utf-8')


def _parse_request_data(request: HttpRequest) -> dict:
    data: dict[str, object] = {}
    data.update(request.GET.dict())
    data.update(request.POST.dict())

    raw_request = getattr(request, '_request', request)
    raw_body = getattr(raw_request, 'body', b'')
    if isinstance(raw_body, bytes):
        raw_body = raw_body.decode('utf-8', errors='ignore')
    raw_body = str(raw_body).strip()

    if raw_body:
        if '=' in raw_body and '\t' not in raw_body:
            for chunk in raw_body.split('&'):
                if '=' not in chunk:
                    continue
                key, value = chunk.split('=', 1)
                data[key.strip()] = value.strip()
        else:
            iclock_rows = _parse_iclock_rows(raw_body)
            if iclock_rows:
                data['rows'] = iclock_rows
                data.update(iclock_rows[-1])
            else:
                # Fallback: store as raw string.
                data['raw'] = raw_body
    return data


@method_decorator(csrf_exempt, name='dispatch')
class IClockCDataView(APIView):
    """API endpoint for iClock device data synchronization"""
    permission_classes = [AllowAny]
    parser_classes = [PlainTextParser, FormParser, MultiPartParser, JSONParser]
    
    def get(self, request: HttpRequest, *args, **kwargs):
        sn = request.GET.get('SN')
        if sn:
            register_biometric_device(sn, last_seen_at=timezone.now())
        # Get current localized time based on your settings.py
        now = timezone.localtime(timezone.now())
        stamp = now.strftime('%Y-%m-%d %H:%M:%S')

        # CRITICAL: This overrides the device's internal +8:00 default
        if 'options=all' in request.get_full_path():
            # TimeZone=345 is the specific code for Nepal (+5:45)
            return _plain_text_response(f'TimeZone=345\nRealTime=1\nStamp={stamp}\nGET OK')

        return _plain_text_response(f'GET OK\nStamp={stamp}')

    def post(self, request: HttpRequest, *args, **kwargs):
        # Some iClock devices send unexpected Content-Types (e.g. plain text or
        # octet-stream) that DRF may not have a parser for and will raise
        # UnsupportedMediaType when accessing `request.data`. Try to use
        # `request.data`, but fall back to parsing the raw body.
        raw_request = getattr(request, '_request', request)
        raw_body = getattr(raw_request, 'body', b'')
        if isinstance(raw_body, bytes):
            raw_body = raw_body.decode('utf-8', errors='ignore')
        raw_body = str(raw_body).strip()
        print(raw_body)

        try:
            payload = request.data if hasattr(request, 'data') else _parse_request_data(request)
        except UnsupportedMediaType:
            payload = _parse_request_data(request)

        # If PlainTextParser (or another parser) returned a non-dict payload,
        # fall back to the raw-body parser so text/plain ATTLOG rows are handled
        # consistently no matter how DRF exposes the body.
        if not isinstance(payload, dict):
            payload = _parse_request_data(request)

        if raw_body and isinstance(payload, dict) and 'rows' not in payload and 'raw' not in payload:
            parsed_rows = _parse_iclock_rows(raw_body)
            if parsed_rows:
                payload['rows'] = parsed_rows
                payload.update(parsed_rows[-1])
            else:
                payload['raw'] = raw_body
        
        base_payload = dict(payload) if isinstance(payload, dict) else {}
        base_payload.update(request.GET.dict())
        rows = base_payload.pop('rows', None)
        if isinstance(rows, list) and rows:
            records = [{**base_payload, **row} for row in rows if isinstance(row, dict)]
        else:
            records = [base_payload]

        recorded_count = 0
        for record_payload in records:
            sn = _pick_value(record_payload, ['SN', 'sn', 'device_sn', 'DeviceSN'], 'unknown')
            employee_identifier = _pick_value(
                record_payload,
                ['PIN', 'pin', 'UserID', 'userid', 'USERID', 'EMPID', 'empid', 'employee_id', 'device_id', 'CardNo', 'cardno', 'ID', 'id'],
            )
            event_code = parse_event_code(
                _pick_value(record_payload, ['event_code', 'event', 'type', 'eventtype', 'eventType', 'attendance_type', 'status'])
            )
            event_time = parse_device_timestamp(
                _pick_value(record_payload, ['timestamp', 'time', 'datetime', 'date_time', 'punch_time', 'punchTime'])
            )

            if sn:
                register_biometric_device(sn, last_seen_at=event_time)

            employee = resolve_employee(employee_identifier, device_serial=sn)
            if employee is None:
                continue

            if event_code is None:
                event_code = infer_next_event_code(employee, event_time)

            if sn:
                device = register_biometric_device(
                    sn,
                    enterprise=getattr(employee, 'enterprise', None),
                    branch=getattr(employee, 'branch', None),
                    last_seen_at=event_time,
                )
                if device is not None and device.enterprise_id is None and employee.enterprise_id is not None:
                    device.enterprise = employee.enterprise
                    device.branch = employee.branch
                    device.save(update_fields=['enterprise', 'branch'])


            summary, event = record_device_event(
                employee=employee,
                event_type=event_code,
                event_time=event_time,
                device_serial=str(sn),
                raw_payload=record_payload,
            )
            recorded_count += 1
        return _plain_text_response('OK')


@method_decorator(csrf_exempt, name='dispatch')
class IClockGetRequestView(APIView):
    """API endpoint for iClock heartbeat/keepalive"""
    permission_classes = [AllowAny]
    
    def get(self, request: HttpRequest, *args, **kwargs):
        return _plain_text_response('OK')

    def post(self, request: HttpRequest, *args, **kwargs):
        return _plain_text_response('OK')


def _sse_event_stream(request):
    """Streaming generator for SSE events. Returns event text blocks.

    This is a simple public stream. For production you'd want auth and
    a more robust broker (Redis, channels, etc.).
    """
    q = subscribe()

    try:
        # Keep yielding events from the queue as they arrive
        while True:
            try:
                data = q.get()
            except GeneratorExit:
                break
            if data is None:
                continue
            # SSE requires lines beginning with 'data: '
            yield f"data: {data}\n\n"
    finally:
        unsubscribe(q)


def sse_events_view(request: HttpRequest):
    # StreamingHttpResponse with the proper SSE content type
    response = StreamingHttpResponse(_sse_event_stream(request), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


class LateArrivalsAPIView(APIView):
    """API endpoint for late arrivals on a given date with optional filters.
    
    Query params:
    - attendance_date: Date to check (default today)
    - branch_id: Filter by branch ID (optional)
    - department_id: Filter by department ID (optional)
    """
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = DefaultPagination

    def get(self, request: HttpRequest):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise found for this user'}, status=403)

        # Support both AD and BS date inputs. The frontend should send
        # `dateFormat=bs` when providing Nepali (Bikram Sambat) dates so
        # the backend can convert them to AD for querying.
        date_format = request.query_params.get('dateFormat') or request.query_params.get('date_format')
        attendance_date = _parse_date_param(request.query_params.get('attendance_date'), date_format=date_format)

        branch_id = _parse_optional_int(request.query_params.get('branch_id'))
        department_id = _parse_optional_int(request.query_params.get('department_id'))

        if request.query_params.get('branch_id') and branch_id is None:
            return Response({'error': 'Invalid branch_id'}, status=400)
        if request.query_params.get('department_id') and department_id is None:
            return Response({'error': 'Invalid department_id'}, status=400)
        if branch_id and not Branch.objects.filter(id=branch_id, enterprise=enterprise).exists():
            return Response({'error': 'Branch not found for your enterprise'}, status=404)
        if department_id and not Department.objects.filter(id=department_id, enterprise=enterprise).exists():
            return Response({'error': 'Department not found for your enterprise'}, status=404)
        
        late_arrivals = get_late_arrivals(
            attendance_date=attendance_date,
            branch_id=branch_id,
            department_id=department_id,
            enterprise_id=enterprise.id,
        )

        paginator = self.pagination_class()
        page_arrivals = paginator.paginate_queryset(late_arrivals, request, view=self)

        serialized = []
        for arrival in page_arrivals:
            employee = arrival.get('employee')
            emp_data = _serialize_employee_min(employee)

            serialized.append({
                'employee': emp_data,
                'check_in': _dt_iso(arrival.get('check_in')),
                'scheduled_arrival': _dt_iso(arrival.get('scheduled_arrival')),
                'late_seconds': int(arrival.get('late_seconds') or 0),
                'late_minutes': round(arrival.get('late_seconds', 0) / 60, 1),
            })

        requested_format = _get_requested_date_format(request)

        return Response({
            'late_arrivals': serialized,
            'count': paginator.page.paginator.count,
            'attendance_date': str(attendance_date or timezone.localdate()),
            'attendance_date_ad': _format_ad_bs(attendance_date or timezone.localdate())[0],
            'attendance_date_bs': _format_ad_bs(attendance_date or timezone.localdate())[1],
            'requested_date_format': requested_format,
            'pagination': {
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'page': paginator.page.number,
                'page_size': self.pagination_class.page_size,
            },
        })


class EarlyDeparturesAPIView(APIView):
    """API endpoint for early departures on a given date with optional filters.
    
    Query params:
    - attendance_date: Date to check (default today)
    - branch_id: Filter by branch ID (optional)
    - department_id: Filter by department ID (optional)
    """
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = DefaultPagination

    def get(self, request: HttpRequest):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise found for this user'}, status=403)

        # Support both AD and BS date inputs. The frontend should send
        # `dateFormat=bs` when providing Nepali (Bikram Sambat) dates so
        # the backend can convert them to AD for querying.
        date_format = request.query_params.get('dateFormat') or request.query_params.get('date_format')
        attendance_date = _parse_date_param(request.query_params.get('attendance_date'), date_format=date_format)

        branch_id = _parse_optional_int(request.query_params.get('branch_id'))
        department_id = _parse_optional_int(request.query_params.get('department_id'))

        if request.query_params.get('branch_id') and branch_id is None:
            return Response({'error': 'Invalid branch_id'}, status=400)
        if request.query_params.get('department_id') and department_id is None:
            return Response({'error': 'Invalid department_id'}, status=400)
        if branch_id and not Branch.objects.filter(id=branch_id, enterprise=enterprise).exists():
            return Response({'error': 'Branch not found for your enterprise'}, status=404)
        if department_id and not Department.objects.filter(id=department_id, enterprise=enterprise).exists():
            return Response({'error': 'Department not found for your enterprise'}, status=404)
        
        early_departures = get_early_departures(
            attendance_date=attendance_date,
            branch_id=branch_id,
            department_id=department_id,
            enterprise_id=enterprise.id,
        )

        paginator = self.pagination_class()
        page_departures = paginator.paginate_queryset(early_departures, request, view=self)

        serialized = []
        for departure in page_departures:
            employee = departure.get('employee')
            emp_data = _serialize_employee_min(employee)

            serialized.append({
                'employee': emp_data,
                'check_out': _dt_iso(departure.get('check_out')),
                'scheduled_departure': _dt_iso(departure.get('scheduled_departure')),
                'early_seconds': int(departure.get('early_seconds') or 0),
                'early_minutes': round(departure.get('early_seconds', 0) / 60, 1),
            })

        requested_format = _get_requested_date_format(request)

        return Response({
            'early_departures': serialized,
            'count': paginator.page.paginator.count,
            'attendance_date': str(attendance_date or timezone.localdate()),
            'attendance_date_ad': _format_ad_bs(attendance_date or timezone.localdate())[0],
            'attendance_date_bs': _format_ad_bs(attendance_date or timezone.localdate())[1],
            'requested_date_format': requested_format,
            'pagination': {
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'page': paginator.page.number,
                'page_size': self.pagination_class.page_size,
            },
        })


def _parse_date_param(value: str | None, *, date_format: str | None = None):
    if not value:
        return None

    if date_format == 'bs':
        try:
            from .date_utils import parse_nepali_date_string, bs_to_ad

            normalized = value.replace('/', '-')
            y, m, d = parse_nepali_date_string(normalized)
            return bs_to_ad(y, m, d)
        except Exception:
            return None

    # Try AD formats first
    for fmt in ('%Y-%m-%d', '%Y/%m/%d'):
        try:
            return datetime.strptime(value, fmt).date()
        except (TypeError, ValueError):
            continue

    return None


def _resolve_report_range(request: HttpRequest):
    date_format = request.query_params.get('dateFormat') or request.query_params.get('date_format')
    start_date = _parse_date_param(request.query_params.get('start_date'), date_format=date_format)
    end_date = _parse_date_param(request.query_params.get('end_date'), date_format=date_format)

    meta = {}
    # Record the requested date format so callers / responses can echo it back
    meta['requested_date_format'] = str(date_format).lower() if date_format else ('ad' if (start_date or end_date or request.query_params.get('year') or request.query_params.get('month')) else None)

    if start_date or end_date:
        start_date = start_date or end_date or timezone.localdate()
        end_date = end_date or start_date
        if start_date > end_date:
            return None, None, {'error': 'start_date must be before or equal to end_date'}
        meta['mode'] = 'range'
        return start_date, end_date, meta

    year = request.query_params.get('year')
    month = request.query_params.get('month')
    try:
        if year:
            year = int(year)
        else:
            year = timezone.localdate().year
        if month:
            month = int(month)
        else:
            month = timezone.localdate().month
    except (ValueError, TypeError):
        return None, None, {'error': 'Invalid year or month'}

    _, last_day = calendar.monthrange(year, month)
    meta['mode'] = 'month'
    meta['year'] = year
    meta['month'] = month
    return date(year, month, 1), date(year, month, last_day), meta


class MonthlySummaryAPIView(APIView):
    """Return a compact monthly attendance summary per employee.

    Query params:
    - year: integer (defaults to current year)
    - month: integer 1..12 (defaults to current month)
    - branch_id, department_id optional filters
    """
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = DefaultPagination

    def get(self, request: HttpRequest):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise found for this user'}, status=403)

        start, end, meta = _resolve_report_range(request)
        if meta.get('error'):
            return Response(meta, status=400)

        branch_id = _parse_optional_int(request.query_params.get('branch_id'))
        department_id = _parse_optional_int(request.query_params.get('department_id'))
        employee_id = _parse_optional_int(request.query_params.get('employee_id'))

        if request.query_params.get('branch_id') and branch_id is None:
            return Response({'error': 'Invalid branch_id'}, status=400)
        if request.query_params.get('department_id') and department_id is None:
            return Response({'error': 'Invalid department_id'}, status=400)
        if request.query_params.get('employee_id') and employee_id is None:
            return Response({'error': 'Invalid employee_id'}, status=400)
        if branch_id and not Branch.objects.filter(id=branch_id, enterprise=enterprise).exists():
            return Response({'error': 'Branch not found for your enterprise'}, status=404)
        if department_id and not Department.objects.filter(id=department_id, enterprise=enterprise).exists():
            return Response({'error': 'Department not found for your enterprise'}, status=404)
        if employee_id and not Employee.objects.filter(id=employee_id, enterprise=enterprise).exists():
            return Response({'error': 'Employee not found for your enterprise'}, status=404)

        # Employees to include
        employees = Employee.objects.filter(is_active=True, enterprise=enterprise).select_related('department')
        if branch_id:
            employees = employees.filter(branch_id=branch_id)
        if department_id:
            employees = employees.filter(department_id=department_id)
        if employee_id:
            employees = employees.filter(id=employee_id)

        summaries = DailyAttendance.objects.filter(
            attendance_date__range=(start, end),
            employee__enterprise=enterprise,
        ).select_related('employee', 'employee__department')
        if employee_id:
            summaries = summaries.filter(employee_id=employee_id)

        # Index by employee
        by_emp = {}
        for s in summaries:
            by_emp.setdefault(s.employee_id, []).append(s)

        result = []
        total_days = (end - start).days + 1
        for emp in employees.order_by('name', 'employee_code'):
            records = by_emp.get(emp.id, [])
            present_days = sum(1 for r in records if bool(r.present))
            absent_days = total_days - present_days
            late_days = sum(1 for r in records if DailyAttendanceSerializer(r).data.get('late_seconds', 0) > 0)
            worked_minutes = sum(int(r.worked_minutes or 0) for r in records)

            result.append({
                'employee': {
                    'id': emp.id,
                    'employee_code': emp.employee_code,
                    'name': emp.name,
                },
                'total_days': total_days,
                'present_days': present_days,
                'absent_days': absent_days,
                'late_days': late_days,
                'worked_minutes': worked_minutes,
                'worked_hours': round(worked_minutes / 60, 2),
            })

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(result, request, view=self)

        response_data = {
            'start_date': str(start),
            'end_date': str(end),
            'start_date_ad': _format_ad_bs(start)[0],
            'start_date_bs': _format_ad_bs(start)[1],
            'end_date_ad': _format_ad_bs(end)[0],
            'end_date_bs': _format_ad_bs(end)[1],
            'requested_date_format': meta.get('requested_date_format'),
            'summary': page,
            'count': paginator.page.paginator.count,
            'pagination': {
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'page': paginator.page.number,
                'page_size': self.pagination_class.page_size,
            },
        }
        if meta.get('mode') == 'month':
            response_data['year'] = meta['year']
            response_data['month'] = meta['month']

        return Response(response_data)


class MonthlySummaryDetailedAPIView(APIView):
    """Return a detailed per-employee per-day matrix for a month.

    Query params same as MonthlySummaryAPIView.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = DefaultPagination

    def get(self, request: HttpRequest):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise found for this user'}, status=403)

        start, end, meta = _resolve_report_range(request)
        if meta.get('error'):
            return Response(meta, status=400)

        branch_id = _parse_optional_int(request.query_params.get('branch_id'))
        department_id = _parse_optional_int(request.query_params.get('department_id'))
        employee_id = _parse_optional_int(request.query_params.get('employee_id'))

        if request.query_params.get('branch_id') and branch_id is None:
            return Response({'error': 'Invalid branch_id'}, status=400)
        if request.query_params.get('department_id') and department_id is None:
            return Response({'error': 'Invalid department_id'}, status=400)
        if request.query_params.get('employee_id') and employee_id is None:
            return Response({'error': 'Invalid employee_id'}, status=400)
        if branch_id and not Branch.objects.filter(id=branch_id, enterprise=enterprise).exists():
            return Response({'error': 'Branch not found for your enterprise'}, status=404)
        if department_id and not Department.objects.filter(id=department_id, enterprise=enterprise).exists():
            return Response({'error': 'Department not found for your enterprise'}, status=404)
        if employee_id and not Employee.objects.filter(id=employee_id, enterprise=enterprise).exists():
            return Response({'error': 'Employee not found for your enterprise'}, status=404)

        employees = Employee.objects.filter(is_active=True, enterprise=enterprise)
        if branch_id:
            employees = employees.filter(branch_id=branch_id)
        if department_id:
            employees = employees.filter(department_id=department_id)
        if employee_id:
            employees = employees.filter(id=employee_id)

        employee_ids = list(employees.values_list('id', flat=True))

        summaries = DailyAttendance.objects.filter(
            attendance_date__range=(start, end),
            employee__enterprise=enterprise,
        ).select_related('employee', 'employee__department')
        if employee_id:
            summaries = summaries.filter(employee_id=employee_id)
        by_emp = {}
        for s in summaries:
            by_emp.setdefault(s.employee_id, {})[str(s.attendance_date)] = DailyAttendanceSerializer(s).data

        events_by_emp_date: dict[int, dict[str, list[AttendanceEvent]]] = {}
        if employee_ids:
            attendance_events = (
                AttendanceEvent.objects.filter(
                    employee_id__in=employee_ids,
                    event_time__date__range=(start, end),
                )
                .order_by('event_time', 'id')
            )
            for event in attendance_events:
                event_day = timezone.localtime(event.event_time).date()
                events_by_emp_date.setdefault(event.employee_id, {}).setdefault(str(event_day), []).append(event)

        days = []
        current_day = start
        while current_day <= end:
            days.append(current_day)
            current_day += timedelta(days=1)
        rows = []
        for emp in employees.order_by('name', 'employee_code'):
            emp_days = by_emp.get(emp.id, {})
            # Build day entries
            day_entries = []
            for day_value in days:
                entry = emp_days.get(str(day_value))
                day_events = events_by_emp_date.get(emp.id, {}).get(str(day_value), [])
                break_sessions = []
                current_break_out = None
                for event in day_events:
                    if event.event_type == AttendanceEvent.BREAK_OUT:
                        if current_break_out is not None:
                            break_sessions.append({'break_out': current_break_out, 'break_in': None})
                        current_break_out = event.event_time
                    elif event.event_type == AttendanceEvent.BREAK_IN:
                        if current_break_out is not None:
                            break_sessions.append({'break_out': current_break_out, 'break_in': event.event_time})
                            current_break_out = None
                        else:
                            break_sessions.append({'break_out': None, 'break_in': event.event_time})

                if current_break_out is not None:
                    break_sessions.append({'break_out': current_break_out, 'break_in': None})

                first_break_out = next((session.get('break_out') for session in break_sessions if session.get('break_out')), None)
                last_break_in = next((session.get('break_in') for session in reversed(break_sessions) if session.get('break_in')), None)

                if entry:
                    day_entries.append({
                        **entry,
                        'break_out': _dt_iso(first_break_out),
                        'break_in': _dt_iso(last_break_in),
                        'break_sessions': [
                            {
                                'break_out': _dt_iso(session.get('break_out')),
                                'break_in': _dt_iso(session.get('break_in')),
                            }
                            for session in break_sessions
                        ],
                    })
                else:
                    ad, bs = _format_ad_bs(day_value)
                    day_entries.append({
                        'attendance_date': ad,
                        'attendance_date_ad': ad,
                        'attendance_date_bs': bs,
                        'present': False,
                        'break_out': _dt_iso(first_break_out),
                        'break_in': _dt_iso(last_break_in),
                        'break_sessions': [
                            {
                                'break_out': _dt_iso(session.get('break_out')),
                                'break_in': _dt_iso(session.get('break_in')),
                            }
                            for session in break_sessions
                        ],
                    })

            rows.append({
                'employee': {'id': emp.id, 'name': emp.name, 'employee_code': emp.employee_code},
                'days': day_entries,
            })

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(rows, request, view=self)

        response_data = {
            'start_date': str(start),
            'end_date': str(end),
            'start_date_ad': _format_ad_bs(start)[0],
            'start_date_bs': _format_ad_bs(start)[1],
            'end_date_ad': _format_ad_bs(end)[0],
            'end_date_bs': _format_ad_bs(end)[1],
            'requested_date_format': meta.get('requested_date_format'),
            'days_in_range': len(days),
            'rows': page,
            'count': paginator.page.paginator.count,
            'pagination': {
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'page': paginator.page.number,
                'page_size': self.pagination_class.page_size,
            },
        }
        if meta.get('mode') == 'month':
            response_data['year'] = meta['year']
            response_data['month'] = meta['month']

        return Response(response_data)


def sse_events_view(request: HttpRequest):
    # StreamingHttpResponse with the proper SSE content type
    response = StreamingHttpResponse(_sse_event_stream(request), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


@method_decorator(csrf_exempt, name='dispatch')
class IClockDataParserView(APIView):
    """API endpoint for parsing and storing iClock device data"""
    permission_classes = [AllowAny]
    parser_classes = [PlainTextParser, FormParser, MultiPartParser, JSONParser]

    def post(self, request: HttpRequest, *args, **kwargs):
        raw_request = getattr(request, '_request', request)
        raw_body = getattr(raw_request, 'body', b'')
        if isinstance(raw_body, bytes):
            raw_body = raw_body.decode('utf-8', errors='ignore')
        raw_body = str(raw_body).strip()

        if not raw_body:
            return Response({'error': 'No data received'}, status=400)

        lines = raw_body.splitlines()
        for line in lines:
            try:
                parts = line.split()
                if len(parts) < 4:
                    logger.warning(f"Skipping malformed line: {line}")
                    continue

                # Format: 3	2026-05-04 20:52:43	0	1		0	0
                # User ID, Timestamp, Checkin/Checkout type
                user_id = parts[0]
                timestamp_str = f"{parts[1]} {parts[2]}"
                check_type_str = parts[3]

                # Parse the timestamp
                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')

                # Determine check-in or check-out
                # 0 for check-in, 1 for check-out
                if check_type_str == '0':
                    check_in_time = timestamp
                    check_out_time = None
                elif check_type_str == '1':
                    check_in_time = None
                    check_out_time = timestamp
                else:
                    logger.warning(f"Unknown check type '{check_type_str}' in line: {line}")
                    continue

                # Get or create the employee
                employee, created = Employee.objects.get_or_create(employee_id=user_id)
                if created:
                    logger.info(f"Created new employee with ID: {user_id}")

                # Create or update the attendance record
                # This logic assumes one record per day per employee.
                # If multiple check-ins/outs per day are possible, this needs adjustment.
                record, created = DailyAttendance.objects.get_or_create(
                    employee=employee,
                    attendance_date=timestamp.date(),
                    defaults={'first_check_in': check_in_time, 'last_check_out': check_out_time}
                )

                # Ensure BS date is populated for created records (and kept consistent)
                try:
                    from attendance.date_utils import ad_to_bs
                    from datetime import date as _date

                    y, m, d = ad_to_bs(record.attendance_date)
                    next_bs = _date(int(y), int(m), int(d))
                    if created or record.attendance_date_bs != next_bs:
                        record.attendance_date_bs = next_bs
                        record.save(update_fields=['attendance_date_bs'])
                except Exception:
                    # Non-fatal: continue processing even if conversion fails
                    pass

                if not created:
                    if check_in_time:
                        record.first_check_in = check_in_time
                    if check_out_time:
                        record.last_check_out = check_out_time
                    record.save()
                
                logger.info(f"Processed line: {line}")

            except Exception as e:
                logger.error(f"Error processing line: {line} - {e}")
                continue

        return Response({'status': 'Data processed successfully'}, status=status.HTTP_200_OK)
