from django.contrib import admin

from .models import AttendanceEvent, DailyAttendance


@admin.register(AttendanceEvent)
class AttendanceEventAdmin(admin.ModelAdmin):
    list_display = ('employee', 'event_type', 'event_time', 'device_serial', 'source')
    list_filter = ('event_type', 'source')
    search_fields = ('employee__name', 'employee__employee_code', 'device_serial')
    date_hierarchy = 'event_time'


@admin.register(DailyAttendance)
class DailyAttendanceAdmin(admin.ModelAdmin):
    list_display = (
        'employee',
        'attendance_date',
        'present',
        'first_check_in',
        'last_check_out',
        'worked_minutes',
        'first_ot_in',
        'last_ot_out',
    )
    list_filter = ('attendance_date', 'present')
    search_fields = ('employee__name', 'employee__employee_code')
    date_hierarchy = 'attendance_date'
