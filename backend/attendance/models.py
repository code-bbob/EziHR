from __future__ import annotations

from datetime import timedelta

from django.db import models
from django.utils import timezone

from enterprise.models import Employee
from .date_utils import ad_to_bs, format_bs_date


class AttendanceEvent(models.Model):
    CHECK_IN = 0
    CHECK_OUT = 1
    BREAK_OUT = 2
    BREAK_IN = 3
    OT_IN = 4
    OT_OUT = 5

    EVENT_CHOICES = [
        (CHECK_IN, 'Check-In'),
        (CHECK_OUT, 'Check-Out'),
        (BREAK_OUT, 'Break-Out'),
        (BREAK_IN, 'Break-In'),
        (OT_IN, 'OT-In'),
        (OT_OUT, 'OT-Out'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendance_events')
    event_type = models.PositiveSmallIntegerField(choices=EVENT_CHOICES)
    event_time = models.DateTimeField(default=timezone.now, db_index=True)
    device_serial = models.CharField(max_length=64, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=32, default='device')

    class Meta:
        ordering = ['event_time', 'id']
        indexes = [
            models.Index(fields=['employee', 'event_time']),
            models.Index(fields=['event_type', 'event_time']),
        ]

    def __str__(self) -> str:
        return f'{self.employee.name} - {self.get_event_type_display()} @ {self.event_time:%Y-%m-%d %H:%M:%S}'


class DailyAttendance(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='daily_attendance')
    attendance_date = models.DateField(db_index=True)
    attendance_date_bs = models.DateField(blank=True, null=True, db_index=True)
    first_check_in = models.DateTimeField(blank=True, null=True)
    last_check_out = models.DateTimeField(blank=True, null=True)
    first_ot_in = models.DateTimeField(blank=True, null=True)
    last_ot_out = models.DateTimeField(blank=True, null=True)
    worked_minutes = models.PositiveIntegerField(default=0)
    present = models.BooleanField(default=False)
    last_event_type = models.PositiveSmallIntegerField(choices=AttendanceEvent.EVENT_CHOICES, blank=True, null=True)
    last_event_time = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('employee', 'attendance_date')]
        ordering = ['-attendance_date', 'employee__name']
        indexes = [
            models.Index(fields=['attendance_date', 'employee']),
            models.Index(fields=['attendance_date_bs', 'employee']),
        ]

    def __str__(self) -> str:
        return f'{self.employee.name} - {self.attendance_date}'

    @property
    def attendance_date_ad(self) -> str:
        """Return attendance date in AD (YYYY-MM-DD) string format."""
        try:
            return str(self.attendance_date)
        except Exception:
            return None

    @property
    def attendance_date_bs_display(self) -> str:
        """Return attendance date in Nepali BS formatted string (YYYY-MM-DD)."""
        try:
            if self.attendance_date_bs is not None:
                return str(self.attendance_date_bs)
            y, m, d = ad_to_bs(self.attendance_date)
            return format_bs_date(y, m, d)
        except Exception:
            return None

    @property
    def worked_duration(self) -> timedelta:
        return timedelta(minutes=self.worked_minutes)
