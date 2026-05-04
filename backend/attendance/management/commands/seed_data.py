import random
from datetime import datetime, timedelta, time
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from faker import Faker
from userauth.models import User
from enterprise.models import Enterprise, Branch, Department, Employee
from attendance.models import AttendanceEvent, DailyAttendance

fake = Faker()


class Command(BaseCommand):
    help = 'Seed database with dummy data for analytics'

    def add_arguments(self, parser):
        parser.add_argument(
            '--enterprises',
            type=int,
            default=2,
            help='Number of enterprises to create'
        )
        parser.add_argument(
            '--branches',
            type=int,
            default=3,
            help='Number of branches per enterprise'
        )
        parser.add_argument(
            '--departments',
            type=int,
            default=5,
            help='Number of departments per branch'
        )
        parser.add_argument(
            '--employees',
            type=int,
            default=50,
            help='Number of employees per department'
        )
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Number of days of attendance data to generate'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding'
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing data...')
            AttendanceEvent.objects.all().delete()
            DailyAttendance.objects.all().delete()
            Employee.objects.all().delete()
            Department.objects.all().delete()
            Branch.objects.all().delete()
            Enterprise.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()

        num_enterprises = options['enterprises']
        num_branches = options['branches']
        num_departments = options['departments']
        num_employees = options['employees']
        num_days = options['days']
        today = timezone.localdate()

        self.stdout.write(self.style.SUCCESS('Starting data seeding...'))

        enterprises = self.create_enterprises(num_enterprises)
        branches = self.create_branches(enterprises, num_branches)
        departments = self.create_departments(branches, num_departments)
        employees = self.create_employees(departments, num_employees)
        attendance_stats = self.create_attendance_data(employees, num_days, today=today)

        self.stdout.write(
            self.style.SUCCESS(
                f'\nSuccessfully seeded database with:\n'
                f'- {len(enterprises)} enterprises\n'
                f'- {len(branches)} branches\n'
                f'- {len(departments)} departments\n'
                f'- {len(employees)} employees\n'
                f'- {attendance_stats["days_generated"]} days of attendance data (through {today})\n'
                f'- {attendance_stats["present_days"]} present records\n'
                f'- {attendance_stats["late_days"]} late arrivals\n'
                f'- {attendance_stats["early_departures"]} early departures\n'
                f'- {attendance_stats["overtime_days"]} overtime records'
            )
        )

    def create_enterprises(self, count):
        self.stdout.write('Creating enterprises...')
        enterprises = []
        for i in range(count):
            enterprise = Enterprise.objects.create(
                name=fake.company(),
                address=fake.address(),
                contact_email=fake.email(),
                contact_phone=fake.phone_number(),
                licensed=True,
                licensed_until=timezone.now().date() + timedelta(days=365),
                max_alowed_employees=500,
            )
            enterprises.append(enterprise)
        self.stdout.write(f'Created {count} enterprises')
        return enterprises

    def create_branches(self, enterprises, count):
        self.stdout.write('Creating branches...')
        branches = []
        for enterprise in enterprises:
            for i in range(count):
                branch = Branch.objects.create(
                    enterprise=enterprise,
                    name=f'{fake.city()} Branch {i + 1}',
                    address=fake.address(),
                    contact_email=fake.email(),
                    contact_phone=fake.phone_number(),
                )
                branches.append(branch)
        self.stdout.write(f'Created {len(branches)} branches')
        return branches

    def create_departments(self, branches, count):
        self.stdout.write('Creating departments...')
        departments = []
        department_names = [
            'Engineering', 'Sales', 'Marketing', 'HR', 'Finance',
            'Operations', 'Customer Support', 'Product', 'Design', 'Legal'
        ]
        for branch in branches:
            for i in range(count):
                # Use modulo to cycle through department names to ensure uniqueness
                dept_name = department_names[i % len(department_names)]
                # Add a number suffix if we've cycled through all names
                if i >= len(department_names):
                    dept_name = f'{dept_name} - Team {i // len(department_names) + 1}'
                
                department = Department.objects.create(
                    enterprise=branch.enterprise,
                    branch=branch,
                    name=dept_name,
                    arrival_time=time(hour=9, minute=0),
                    departure_time=time(hour=18, minute=0),
                )
                departments.append(department)
        self.stdout.write(f'Created {len(departments)} departments')
        return departments

    def create_employees(self, departments, count):
        self.stdout.write('Creating employees...')
        password_hash = make_password('testpass123')
        users_to_create = []
        employee_payloads = []
        email_counter = 0
        employee_counter = 1

        for department in departments:
            for _ in range(count):
                email = f'employee_{email_counter}@company.com'
                email_counter += 1
                name = fake.name()
                employee_code = f'EMP{employee_counter:05d}'
                employee_counter += 1
                username = f'emp_{employee_code}'
                role = random.choice(['admin', 'employee'])

                users_to_create.append(
                    User(
                        email=email,
                        name=name,
                        username=username,
                        password=password_hash,
                        is_active=True,
                        is_staff=False,
                        is_superuser=False,
                    )
                )
                employee_payloads.append((department, name, employee_code, role, email))

        User.objects.bulk_create(users_to_create, batch_size=500)
        created_users = {
            user.email: user
            for user in User.objects.filter(email__in=[payload[4] for payload in employee_payloads])
        }

        employees_to_create = []
        for department, name, employee_code, role, email in employee_payloads:
            employees_to_create.append(
                Employee(
                    employee_code=employee_code,
                    name=name,
                    enterprise=department.enterprise,
                    branch=department.branch,
                    department=department,
                    user=created_users[email],
                    role=role,
                    is_active=True,
                )
            )

        Employee.objects.bulk_create(employees_to_create, batch_size=500)
        employees = list(
            Employee.objects.filter(employee_code__in=[payload[2] for payload in employee_payloads])
            .select_related('department', 'enterprise', 'branch', 'user')
            .order_by('employee_code')
        )
        self.stdout.write(f'Created {len(employees)} employees')
        return employees

    def create_attendance_data(self, employees, num_days, today=None):
        self.stdout.write('Creating attendance events...')
        today = today or timezone.localdate()
        if num_days <= 0:
            return {
                'days_generated': 0,
                'present_days': 0,
                'late_days': 0,
                'early_departures': 0,
                'overtime_days': 0,
            }

        base_date = today - timedelta(days=num_days - 1)
        present_days = 0
        late_days = 0
        early_departures = 0
        overtime_days = 0

        for day_offset in range(num_days):
            current_date = base_date + timedelta(days=day_offset)

            # Skip weekends occasionally (but not always to have variety)
            if current_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                if current_date != today and random.random() < 0.7:  # 70% chance to skip weekends
                    continue

            event_batch = []
            summary_batch = []

            for employee_index, employee in enumerate(employees):
                profile = self._build_attendance_profile(current_date, today, employee_index=employee_index)

                # 85% chance of being present on a working day; always seed today with data.
                if profile['present']:
                    created = self.create_daily_attendance(employee, current_date, profile=profile)
                    present_days += 1
                    late_days += int(created['late_seconds'] > 0)
                    early_departures += int(created['early_seconds'] > 0)
                    overtime_days += int(created['overtime_minutes'] > 0)
                    event_batch.extend(created['events'])
                    summary_batch.append(created['summary'])
                else:
                    summary_batch.append(
                        DailyAttendance(
                            employee=employee,
                            attendance_date=current_date,
                            present=False,
                            worked_minutes=0,
                        )
                    )

            if event_batch:
                AttendanceEvent.objects.bulk_create(event_batch, batch_size=1000)
            if summary_batch:
                DailyAttendance.objects.bulk_create(summary_batch, batch_size=1000, ignore_conflicts=True)

        self.stdout.write(
            f'Created attendance records for {num_days} days ending on {today}. '
            f'Present: {present_days}, late: {late_days}, early departures: {early_departures}, overtime: {overtime_days}'
        )
        return {
            'days_generated': num_days,
            'present_days': present_days,
            'late_days': late_days,
            'early_departures': early_departures,
            'overtime_days': overtime_days,
        }

    def _build_attendance_profile(self, attendance_date, today, employee_index=0):
        is_today = attendance_date == today

        if is_today:
            present = True
        else:
            present = random.random() < 0.85

        if not present:
            return {
                'present': False,
                'late_seconds': 0,
                'early_seconds': 0,
                'overtime_minutes': 0,
            }

        if is_today and employee_index < 4:
            scenario = ['late_early', 'late_overtime', 'early_overtime', 'on_time'][employee_index]
        else:
            scenario_weights = [
                ('on_time', 0.28),
                ('late', 0.18),
                ('early', 0.18),
                ('late_early', 0.12),
                ('overtime', 0.12),
                ('late_overtime', 0.06),
                ('early_overtime', 0.03),
                ('full_day', 0.03),
            ]

            if is_today:
                scenario_weights = [
                    ('on_time', 0.12),
                    ('late', 0.20),
                    ('early', 0.15),
                    ('late_early', 0.15),
                    ('overtime', 0.16),
                    ('late_overtime', 0.10),
                    ('early_overtime', 0.06),
                    ('full_day', 0.06),
                ]

            roll = random.random()
            cumulative = 0.0
            scenario = 'on_time'
            for name, weight in scenario_weights:
                cumulative += weight
                if roll <= cumulative:
                    scenario = name
                    break

        late_seconds = 0
        early_seconds = 0
        overtime_minutes = 0

        if scenario in {'late', 'late_early', 'late_overtime'}:
            late_seconds = random.randint(10, 95) * 60
        if scenario in {'early', 'late_early', 'early_overtime'}:
            early_seconds = random.randint(15, 120) * 60
        if scenario in {'overtime', 'late_overtime', 'early_overtime'}:
            overtime_minutes = random.randint(30, 150)

        return {
            'present': True,
            'late_seconds': late_seconds,
            'early_seconds': early_seconds,
            'overtime_minutes': overtime_minutes,
        }

    def create_daily_attendance(self, employee, attendance_date, profile=None):
        """Create a day's worth of attendance events for an employee"""
        profile = profile or self._build_attendance_profile(attendance_date, attendance_date)

        arrival_time = time(hour=9, minute=0)
        departure_time = time(hour=18, minute=0)
        department = getattr(employee, 'department', None)
        if department is not None:
            arrival_time = getattr(department, 'arrival_time', arrival_time) or arrival_time
            departure_time = getattr(department, 'departure_time', departure_time) or departure_time

        arrival_dt = timezone.make_aware(datetime.combine(attendance_date, arrival_time))
        departure_dt = timezone.make_aware(datetime.combine(attendance_date, departure_time))

        late_seconds = int(profile.get('late_seconds') or 0)
        early_seconds = int(profile.get('early_seconds') or 0)
        overtime_minutes = int(profile.get('overtime_minutes') or 0)

        check_in_time = arrival_dt + timedelta(seconds=late_seconds)
        check_out_time = departure_dt - timedelta(seconds=early_seconds)

        if check_out_time <= check_in_time:
            check_out_time = check_in_time + timedelta(hours=7, minutes=30)

        break_out_time = check_in_time + timedelta(hours=random.randint(3, 5), minutes=random.randint(0, 30))
        if break_out_time >= check_out_time:
            break_out_time = check_in_time + timedelta(hours=4)

        break_in_time = break_out_time + timedelta(minutes=random.randint(20, 60))
        if break_in_time >= check_out_time:
            break_in_time = break_out_time + timedelta(minutes=30)

        if overtime_minutes > 0:
            ot_in_time = max(check_out_time + timedelta(minutes=10), departure_dt + timedelta(minutes=5))
            ot_out_time = ot_in_time + timedelta(minutes=overtime_minutes)
        else:
            ot_in_time = None
            ot_out_time = None

        events = [
            AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.CHECK_IN,
                event_time=check_in_time,
                device_serial=f'DEVICE_{random.randint(1000, 9999)}',
                source='device',
            ),
            AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.BREAK_OUT,
                event_time=break_out_time,
                device_serial=f'DEVICE_{random.randint(1000, 9999)}',
                source='device',
            ),
            AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.BREAK_IN,
                event_time=break_in_time,
                device_serial=f'DEVICE_{random.randint(1000, 9999)}',
                source='device',
            ),
            AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.CHECK_OUT,
                event_time=check_out_time,
                device_serial=f'DEVICE_{random.randint(1000, 9999)}',
                source='device',
            ),
        ]

        if ot_in_time and ot_out_time:
            events.extend([
                AttendanceEvent(
                    employee=employee,
                    event_type=AttendanceEvent.OT_IN,
                    event_time=ot_in_time,
                    device_serial=f'DEVICE_{random.randint(1000, 9999)}',
                    source='device',
                ),
                AttendanceEvent(
                    employee=employee,
                    event_type=AttendanceEvent.OT_OUT,
                    event_time=ot_out_time,
                    device_serial=f'DEVICE_{random.randint(1000, 9999)}',
                    source='device',
                ),
            ])

        break_duration = (break_in_time - break_out_time).total_seconds() // 60
        total_duration = (check_out_time - check_in_time).total_seconds() // 60
        worked_minutes = int(total_duration - break_duration + overtime_minutes)

        summary = DailyAttendance(
            employee=employee,
            attendance_date=attendance_date,
            first_check_in=check_in_time,
            last_check_out=check_out_time,
            first_break_out=break_out_time,
            last_break_in=break_in_time,
            first_ot_in=ot_in_time,
            last_ot_out=ot_out_time,
            worked_minutes=worked_minutes,
            present=True,
            last_event_type=AttendanceEvent.OT_OUT if ot_out_time else AttendanceEvent.CHECK_OUT,
            last_event_time=ot_out_time or check_out_time,
        )

        return {
            'events': events,
            'summary': summary,
            'late_seconds': late_seconds,
            'early_seconds': early_seconds,
            'overtime_minutes': overtime_minutes,
        }

