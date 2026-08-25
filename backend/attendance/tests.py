from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from datetime import datetime
from rest_framework.test import APIClient

from attendance.models import AttendanceEvent, DailyAttendance
from attendance.date_utils import ad_to_bs, format_bs_date
from attendance.services import build_dashboard_rows, record_device_event
from enterprise.models import Employee, Enterprise, Branch
from device.models import BiometricDevice, EmployeeBiometricMapping


class AttendanceAggregationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.enterprise = Enterprise.objects.create(name='Test Enterprise')
        self.user = get_user_model().objects.create_user(
            username='admin',
            password='pass12345',
            email='admin@example.com',
            name='Admin User',
            is_staff=True,
        )
        self.employee = Employee.objects.create(
            employee_code='EMP001',
            name='Alice Example',
            user=self.user,
            enterprise=self.enterprise,
        )
        self.client.force_authenticate(user=self.user)

    def test_earliest_check_in_and_latest_check_out_are_kept(self):
        first_in = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
        second_in = first_in + timezone.timedelta(minutes=15)
        first_out = first_in + timezone.timedelta(hours=8)
        second_out = first_out + timezone.timedelta(minutes=45)

        record_device_event(self.employee, AttendanceEvent.CHECK_IN, first_in)
        record_device_event(self.employee, AttendanceEvent.CHECK_IN, second_in)
        record_device_event(self.employee, AttendanceEvent.CHECK_OUT, first_out)
        record_device_event(self.employee, AttendanceEvent.CHECK_OUT, second_out)

        summary = DailyAttendance.objects.get(employee=self.employee, attendance_date=timezone.localdate(first_in))
        self.assertEqual(summary.first_check_in, first_in)
        self.assertEqual(summary.last_check_out, second_out)
        self.assertTrue(summary.present)
        self.assertGreater(summary.worked_minutes, 0)

    def test_dashboard_includes_registered_staff_without_events(self):
        other_employee = Employee.objects.create(employee_code='EMP002', name='Bob Example')
        record_device_event(self.employee, AttendanceEvent.CHECK_IN, timezone.now())

        rows = build_dashboard_rows()
        self.assertEqual(len(rows), 2)
        bob_row = next(row for row in rows if row['employee'] == other_employee)
        self.assertFalse(bob_row['present'])
        self.assertEqual(bob_row['worked_minutes'], 0)

    def test_dashboard_stats_include_present_absent_avg_highest_lowest(self):
        bob = Employee.objects.create(employee_code='EMP002', name='Bob Example', enterprise=self.enterprise)
        base_time = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)

        record_device_event(self.employee, AttendanceEvent.CHECK_IN, base_time)
        record_device_event(self.employee, AttendanceEvent.CHECK_OUT, base_time + timezone.timedelta(hours=8))

        record_device_event(bob, AttendanceEvent.CHECK_IN, base_time)
        record_device_event(bob, AttendanceEvent.CHECK_OUT, base_time + timezone.timedelta(hours=6))

        charlie = Employee.objects.create(employee_code='EMP003', name='Charlie Example', enterprise=self.enterprise)

        response = self.client.get('/attendance/api/daily/')
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        stats = payload['stats']

        self.assertEqual(stats['total_employees'], 3)
        self.assertEqual(stats['present_today'], 2)
        self.assertEqual(stats['absent_today'], 1)
        self.assertEqual(stats['average_worked_minutes'], 280)
        self.assertAlmostEqual(stats['average_worked_hours'], 4.67, places=2)

        self.assertEqual(stats['highest_working_time']['employee']['employee_code'], 'EMP001')
        self.assertEqual(stats['highest_working_time']['worked_minutes'], 480)
        self.assertEqual(stats['lowest_working_time']['employee']['employee_code'], 'EMP002')
        self.assertEqual(stats['lowest_working_time']['worked_minutes'], 360)

    def test_iclock_cdata_endpoint_accepts_device_payload(self):
        response = self.client.get('/iclock/cdata/', {'SN': 'DEVICE-01'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('Stamp=', response.content.decode())
        self.assertTrue(BiometricDevice.objects.filter(serial_number='DEVICE-01').exists())

        response = self.client.post(
            '/iclock/cdata/',
            data={'SN': 'DEVICE-01', 'PIN': 'EMP001', 'event_code': '0', 'timestamp': '2026-04-28 09:00:00'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode().strip(), 'OK')
        self.assertEqual(AttendanceEvent.objects.count(), 1)
        self.assertEqual(DailyAttendance.objects.count(), 1)

    def test_daily_response_includes_bs_date_fields(self):
        base_time = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
        record_device_event(self.employee, AttendanceEvent.CHECK_IN, base_time)

        response = self.client.get('/attendance/api/daily/')
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        bs_year, bs_month, bs_day = ad_to_bs(timezone.localdate(base_time))
        expected_bs = format_bs_date(bs_year, bs_month, bs_day)

        self.assertEqual(payload['attendance_date_ad'], str(timezone.localdate(base_time)))
        self.assertEqual(payload['attendance_date_bs'], expected_bs)

        row = payload['attendance_rows'][0]
        self.assertEqual(row['summary']['attendance_date_ad'], str(timezone.localdate(base_time)))
        self.assertEqual(row['summary']['attendance_date_bs'], expected_bs)

    def test_monthly_summary_accepts_bs_dates_when_date_format_is_bs(self):
        base_time = timezone.make_aware(datetime(2026, 5, 5, 9, 0, 0), timezone.get_current_timezone())
        record_device_event(self.employee, AttendanceEvent.CHECK_IN, base_time)

        bs_year, bs_month, bs_day = ad_to_bs(base_time.date())
        bs_date = format_bs_date(bs_year, bs_month, bs_day)

        response = self.client.get(
            '/attendance/api/reports/monthly-summary/',
            {'start_date': bs_date, 'end_date': bs_date, 'dateFormat': 'bs'},
        )
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(payload['start_date'], str(base_time.date()))
        self.assertEqual(payload['end_date'], str(base_time.date()))
        self.assertEqual(payload['start_date_bs'], bs_date)
        self.assertEqual(payload['end_date_bs'], bs_date)

    def test_iclock_cdata_uses_device_specific_employee_mapping(self):
        enterprise = Enterprise.objects.create(name='Acme')
        branch = Branch.objects.create(enterprise=enterprise, name='Main')
        device = BiometricDevice.objects.create(enterprise=enterprise, branch=branch, serial_number='DEVICE-02')

        other_user = get_user_model().objects.create_user(
            username='other',
            password='pass12345',
            email='other@example.com',
            name='Other User',
        )
        other_employee = Employee.objects.create(employee_code='EMP999', name='Mapped Employee', user=other_user, enterprise=enterprise, branch=branch)
        EmployeeBiometricMapping.objects.create(employee=other_employee, device=device, device_user_id='1')

        response = self.client.post(
            '/iclock/cdata/?SN=DEVICE-02',
            data='1\t2026-04-28 09:00:00\t0\t1\t\t0\t0',
            content_type='text/plain',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(AttendanceEvent.objects.count(), 1)
        self.assertEqual(AttendanceEvent.objects.first().employee, other_employee)

    def test_iclock_cdata_parses_attlog_tab_separated_rows(self):
        response = self.client.post(
            '/iclock/cdata/?SN=DEVICE-01',
            data='EMP001\t2026-04-28 22:41:25\t0\t1\t\t0\t0',
            content_type='text/plain',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode().strip(), 'OK')
        self.assertEqual(AttendanceEvent.objects.count(), 1)

        event = AttendanceEvent.objects.first()
        self.assertEqual(event.employee, self.employee)
        self.assertEqual(event.event_type, AttendanceEvent.CHECK_IN)

    def test_first_punch_sent_as_check_out_is_recorded_as_check_in(self):
        today = timezone.localdate()
        response = self.client.post(
            '/iclock/cdata/?SN=DEVICE-01',
            data=f'EMP001\t{today} 09:00:00\t1\t0\t\t0\t0',
            content_type='text/plain',
        )

        self.assertEqual(response.status_code, 200)
        event = AttendanceEvent.objects.first()
        self.assertEqual(event.event_type, AttendanceEvent.CHECK_IN)

        summary = DailyAttendance.objects.get(employee=self.employee, attendance_date=today)
        self.assertTrue(summary.present)
        self.assertEqual(summary.last_check_out, None)

    def test_duplicate_check_in_is_normalized_to_check_out(self):
        today = timezone.localdate()
        response = self.client.post(
            '/iclock/cdata/?SN=DEVICE-01',
            data=f'EMP001\t{today} 09:00:00\t0\t0\t\t0\t0',
            content_type='text/plain',
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            '/iclock/cdata/?SN=DEVICE-01',
            data=f'EMP001\t{today} 17:00:00\t0\t0\t\t0\t0',
            content_type='text/plain',
        )
        self.assertEqual(response.status_code, 200)

        events = list(AttendanceEvent.objects.order_by('event_time', 'id'))
        self.assertEqual([event.event_type for event in events], [AttendanceEvent.CHECK_IN, AttendanceEvent.CHECK_OUT])

        summary = DailyAttendance.objects.get(employee=self.employee, attendance_date=today)
        self.assertEqual(timezone.localtime(summary.first_check_in).hour, 9)
        self.assertIsNotNone(summary.last_check_out)
        self.assertGreater(summary.worked_minutes, 0)

    def test_distinct_event_codes_are_preserved(self):
        today = timezone.localdate()
        self.client.post(
            '/iclock/cdata/?SN=DEVICE-01',
            data=f'EMP001\t{today} 09:00:00\t0\t0\t\t0\t0',
            content_type='text/plain',
        )
        self.client.post(
            '/iclock/cdata/?SN=DEVICE-01',
            data=f'EMP001\t{today} 12:00:00\t2\t0\t\t0\t0',
            content_type='text/plain',
        )

        events = list(AttendanceEvent.objects.order_by('event_time', 'id'))
        self.assertEqual([event.event_type for event in events], [AttendanceEvent.CHECK_IN, AttendanceEvent.BREAK_OUT])

    def test_iclock_cdata_parses_raw_body_when_query_params_are_present(self):
        response = self.client.post(
            '/iclock/cdata/?SN=DEVICE-01&table=ATTLOG&Stamp=9999',
            data='EMP001\t2026-04-28 22:41:25\t0\t1\t\t0\t0',
            content_type='text/plain',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode().strip(), 'OK')
        self.assertEqual(AttendanceEvent.objects.count(), 1)

        event = AttendanceEvent.objects.first()
        self.assertEqual(event.employee, self.employee)
        self.assertEqual(event.event_type, AttendanceEvent.CHECK_IN)

    def test_iclock_cdata_parses_multiple_attlog_rows(self):
        raw_payload = (
            'EMP001\t2026-04-28 22:41:10\t0\t1\t\t0\t0\n'
            'EMP001\t2026-04-28 22:42:25\t0\t0\t\t0\t0\n'
        )
        response = self.client.post(
            '/iclock/cdata/?SN=DEVICE-01',
            data=raw_payload,
            content_type='text/plain',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode().strip(), 'OK')
        self.assertEqual(AttendanceEvent.objects.count(), 2)

    def test_iclock_cdata_constant_status_is_normalized(self):
        raw_payload = (
            'EMP001\t2026-04-28 08:00:00\t0\t1\t\t0\t0\n'
            'EMP001\t2026-04-28 17:00:00\t0\t1\t\t0\t0\n'
        )

        response = self.client.post(
            '/iclock/cdata/?SN=DEVICE-01',
            data=raw_payload,
            content_type='text/plain',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode().strip(), 'OK')

        events = list(AttendanceEvent.objects.order_by('event_time', 'id'))
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0].event_type, AttendanceEvent.CHECK_IN)
        self.assertEqual(events[1].event_type, AttendanceEvent.CHECK_OUT)
