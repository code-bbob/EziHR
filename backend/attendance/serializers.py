from rest_framework import serializers

from .models import AttendanceEvent, DailyAttendance


class AttendanceEventSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    
    class Meta:
        model = AttendanceEvent
        fields = [
            'id', 'employee', 'employee_name', 'event_type', 'event_type_display',
            'event_time', 'device_serial', 'raw_payload', 'source'
        ]
        read_only_fields = ['id', 'raw_payload']


class DailyAttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    worked_hours = serializers.SerializerMethodField()
    attendance_date_ad = serializers.SerializerMethodField()
    attendance_date_bs = serializers.SerializerMethodField()
    # Lateness / early departure derived from enterprise schedule
    late_seconds = serializers.SerializerMethodField()
    early_seconds = serializers.SerializerMethodField()
    late_duration = serializers.SerializerMethodField()
    early_duration = serializers.SerializerMethodField()
    scheduled_arrival = serializers.SerializerMethodField()
    scheduled_departure = serializers.SerializerMethodField()
    
    class Meta:
        model = DailyAttendance
        fields = [
            'id', 'employee', 'employee_name', 'employee_code', 'attendance_date',
            'attendance_date_ad', 'attendance_date_bs',
            'first_check_in', 'last_check_out',
            'first_ot_in', 'last_ot_out', 'worked_minutes', 'worked_hours',
            'present', 'last_event_type', 'last_event_time', 'updated_at',
            'late_seconds', 'early_seconds', 'late_duration', 'early_duration',
            'scheduled_arrival', 'scheduled_departure'
        ]
        read_only_fields = ['id', 'updated_at']
    
    def get_worked_hours(self, obj):
        """Return worked time as hours (float)"""
        return round(obj.worked_minutes / 60, 2)

    def get_attendance_date_ad(self, obj):
        try:
            return obj.attendance_date_ad
        except Exception:
            return None

    def get_attendance_date_bs(self, obj):
        try:
            if obj.attendance_date_bs:
                return str(obj.attendance_date_bs)
            from .date_utils import ad_to_bs, format_bs_date

            year, month, day = ad_to_bs(obj.attendance_date)
            return format_bs_date(year, month, day)
        except Exception:
            return None

    def _get_schedule_datetimes(self, obj):
        from datetime import datetime as _dt, time as _time
        from django.utils import timezone as _tz

        employee = getattr(obj, 'employee', None)
        arrival_time = getattr(employee, 'arrival_time', None) if employee else None
        departure_time = getattr(employee, 'departure_time', None) if employee else None
        department = getattr(employee, 'department', None) if employee else None
        if arrival_time is None and department:
            arrival_time = getattr(department, 'arrival_time', None)
        if departure_time is None and department:
            departure_time = getattr(department, 'departure_time', None)
        if arrival_time is None:
            arrival_time = _time(hour=9, minute=0)
        if departure_time is None:
            departure_time = _time(hour=18, minute=0)

        arrival_dt = _dt.combine(obj.attendance_date, arrival_time)
        departure_dt = _dt.combine(obj.attendance_date, departure_time)
        if _tz.is_naive(arrival_dt):
            arrival_dt = _tz.make_aware(arrival_dt, _tz.get_current_timezone())
        if _tz.is_naive(departure_dt):
            departure_dt = _tz.make_aware(departure_dt, _tz.get_current_timezone())
        return arrival_dt, departure_dt

    def get_late_seconds(self, obj):
        if not obj or not obj.first_check_in:
            return 0
        arrival_dt, _ = self._get_schedule_datetimes(obj)
        if obj.first_check_in <= arrival_dt:
            return 0
        return int((obj.first_check_in - arrival_dt).total_seconds())

    def get_early_seconds(self, obj):
        if not obj or not obj.last_check_out:
            return 0
        _, departure_dt = self._get_schedule_datetimes(obj)
        if obj.last_check_out >= departure_dt:
            return 0
        return int((departure_dt - obj.last_check_out).total_seconds())

    def get_late_duration(self, obj):
        secs = self.get_late_seconds(obj)
        if not secs:
            return None
        from datetime import timedelta as _td
        return str(_td(seconds=secs))

    def get_early_duration(self, obj):
        secs = self.get_early_seconds(obj)
        if not secs:
            return None
        from datetime import timedelta as _td
        return str(_td(seconds=secs))

    def get_scheduled_arrival(self, obj):
        arrival_dt, _ = self._get_schedule_datetimes(obj)
        try:
            return arrival_dt.isoformat()
        except Exception:
            return None

    def get_scheduled_departure(self, obj):
        _, departure_dt = self._get_schedule_datetimes(obj)
        try:
            return departure_dt.isoformat()
        except Exception:
            return None
