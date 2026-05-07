import random
from datetime import datetime, timedelta, time, date as _date
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from enterprise.models import Enterprise, Branch, Department, Employee
from attendance.models import AttendanceEvent, DailyAttendance


# Nepali names for realistic data
NEPALI_FIRST_NAMES_MALE = [
    'Aarav', 'Bikash', 'Chandan', 'Deepak', 'Gaurav', 'Hari', 'Ishwor',
    'Kiran', 'Lokesh', 'Manish', 'Nabin', 'Pawan', 'Rajesh', 'Sagar',
    'Sunil', 'Umesh', 'Yogesh', 'Anish', 'Bipin', 'Dinesh', 'Ganesh',
    'Krishna', 'Niraj', 'Prakash', 'Ramesh', 'Santosh', 'Aashish', 'Bijay',
]
NEPALI_FIRST_NAMES_FEMALE = [
    'Aarti', 'Binita', 'Deepa', 'Gita', 'Kamala', 'Laxmi', 'Nisha',
    'Puja', 'Rekha', 'Sabina', 'Sunita', 'Uma', 'Anita', 'Durga',
    'Mina', 'Rita', 'Sita', 'Tara', 'Sarita', 'Sangita', 'Priya',
]
NEPALI_LAST_NAMES = [
    'Adhikari', 'Basnet', 'Bhatt', 'Bhandari', 'Chhetri', 'Dahal',
    'Gautam', 'Gurung', 'Joshi', 'Karki', 'KC', 'Koirala', 'Lamichhane',
    'Maharjan', 'Neupane', 'Pandey', 'Poudel', 'Rai', 'Sharma', 'Shrestha',
    'Subedi', 'Thapa', 'Tamang', 'Acharya', 'Ghimire', 'Sapkota', 'Regmi',
]

DEPARTMENT_CONFIGS = [
    {'name': 'Engineering', 'arrival': time(9, 0), 'departure': time(18, 0), 'size': 8},
    {'name': 'Sales & Marketing', 'arrival': time(9, 30), 'departure': time(18, 30), 'size': 5},
    {'name': 'Human Resources', 'arrival': time(9, 0), 'departure': time(17, 0), 'size': 3},
    {'name': 'Finance', 'arrival': time(9, 0), 'departure': time(17, 30), 'size': 4},
    {'name': 'Operations', 'arrival': time(8, 30), 'departure': time(17, 30), 'size': 5},
]


class Command(BaseCommand):
    help = 'Seed database with realistic dummy data for analytics'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Number of days of attendance data to generate (default: 90)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear ALL existing attendance data, employees (except superusers), departments before seeding',
        )

    def handle(self, *args, **options):
        num_days = options['days']
        today = timezone.localdate()

        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing existing attendance, employee & department data...'))
            AttendanceEvent.objects.all().delete()
            DailyAttendance.objects.all().delete()
            Employee.objects.all().delete()
            Department.objects.all().delete()
            self.stdout.write('  ✓ Cleared')

        # ── Get or create the enterprise & branch ──────────────────────
        enterprise = Enterprise.objects.first()
        if enterprise is None:
            enterprise = Enterprise.objects.create(
                name='Digitech',
                address='Basundhara, Kathmandu',
                contact_email='info@digitech.com.np',
                contact_phone='01-4567890',
                licensed=True,
                licensed_until=today + timedelta(days=365),
                max_alowed_employees=200,
            )
        self.stdout.write(f'Enterprise: {enterprise.name} (id={enterprise.id})')

        branch = Branch.objects.filter(enterprise=enterprise).first()
        if branch is None:
            branch = Branch.objects.create(
                enterprise=enterprise,
                name='Basundhara',
                address='Basundhara, Kathmandu',
                contact_email='basundhara@digitech.com.np',
                contact_phone='01-4567891',
            )
        self.stdout.write(f'Branch: {branch.name} (id={branch.id})')

        # ── Create departments ─────────────────────────────────────────
        departments = self._create_departments(enterprise, branch)

        # ── Create employees ───────────────────────────────────────────
        employees = self._create_employees(enterprise, branch, departments)

        # ── Generate attendance ────────────────────────────────────────
        stats = self._generate_attendance(employees, num_days, today)

        self.stdout.write(self.style.SUCCESS(
            f'\n{"=" * 60}\n'
            f'  ✅ Seed complete!\n'
            f'{"=" * 60}\n'
            f'  Enterprise:       {enterprise.name}\n'
            f'  Branch:           {branch.name}\n'
            f'  Departments:      {len(departments)}\n'
            f'  Employees:        {len(employees)}\n'
            f'  Date range:       {today - timedelta(days=num_days - 1)} → {today}\n'
            f'  Working days:     {stats["working_days"]}\n'
            f'  Present records:  {stats["present"]}\n'
            f'  Absent records:   {stats["absent"]}\n'
            f'  Late arrivals:    {stats["late"]}\n'
            f'  Early departures: {stats["early"]}\n'
            f'  Overtime days:    {stats["overtime"]}\n'
            f'  Events created:   {stats["events"]}\n'
            f'{"=" * 60}'
        ))

    # ─── Departments ──────────────────────────────────────────────────

    def _create_departments(self, enterprise, branch):
        departments = []
        for config in DEPARTMENT_CONFIGS:
            dept, created = Department.objects.get_or_create(
                enterprise=enterprise,
                branch=branch,
                name=config['name'],
                defaults={
                    'arrival_time': config['arrival'],
                    'departure_time': config['departure'],
                },
            )
            if not created:
                dept.arrival_time = config['arrival']
                dept.departure_time = config['departure']
                dept.save(update_fields=['arrival_time', 'departure_time'])
            departments.append(dept)
            tag = 'created' if created else 'exists'
            self.stdout.write(f'  Department: {dept.name} ({tag})')

        return departments

    # ─── Employees ────────────────────────────────────────────────────

    def _create_employees(self, enterprise, branch, departments):
        # Assign existing unassigned employees to departments
        existing = list(Employee.objects.filter(
            enterprise=enterprise,
            department__isnull=True,
        ))
        for i, emp in enumerate(existing):
            emp.department = departments[i % len(departments)]
            emp.branch = branch
            emp.save(update_fields=['department', 'branch'])
            self.stdout.write(f'  Assigned existing employee {emp.name} → {emp.department.name}')

        # Also assign employees that have departments already
        assigned_existing = list(Employee.objects.filter(
            enterprise=enterprise,
            department__isnull=False,
        ))

        # Determine how many new employees to create per department
        used_names = set()
        new_employees = []
        employee_code_start = (Employee.objects.count() or 0) + 10

        for dept_config, department in zip(DEPARTMENT_CONFIGS, departments):
            current_count = Employee.objects.filter(department=department).count()
            target = dept_config['size']
            to_create = max(0, target - current_count)

            for j in range(to_create):
                if random.random() < 0.45:
                    first = random.choice(NEPALI_FIRST_NAMES_FEMALE)
                else:
                    first = random.choice(NEPALI_FIRST_NAMES_MALE)
                last = random.choice(NEPALI_LAST_NAMES)
                name = f'{first} {last}'

                # Ensure unique-ish names
                while name in used_names:
                    last = random.choice(NEPALI_LAST_NAMES)
                    name = f'{first} {last}'
                used_names.add(name)

                code = str(employee_code_start)
                employee_code_start += 1

                emp = Employee(
                    employee_code=code,
                    name=name,
                    enterprise=enterprise,
                    branch=branch,
                    department=department,
                    role='employee',
                    is_active=True,
                    email=f'{first.lower()}.{last.lower()}@digitech.com.np',
                    phone=f'98{random.randint(10000000, 99999999)}',
                )
                new_employees.append(emp)

        if new_employees:
            Employee.objects.bulk_create(new_employees, batch_size=200)
            self.stdout.write(f'  Created {len(new_employees)} new employees')

        all_employees = list(
            Employee.objects.filter(enterprise=enterprise, is_active=True)
            .select_related('department', 'branch', 'enterprise')
            .order_by('name')
        )
        self.stdout.write(f'  Total active employees: {len(all_employees)}')
        return all_employees

    # ─── Attendance generation ────────────────────────────────────────

    def _generate_attendance(self, employees, num_days, today):
        base_date = today - timedelta(days=num_days - 1)

        stats = {
            'working_days': 0,
            'present': 0,
            'absent': 0,
            'late': 0,
            'early': 0,
            'overtime': 0,
            'events': 0,
        }

        # Build employee "personality" profiles for consistent patterns
        # Some employees are chronically late, some always on time, etc.
        profiles = {}
        for emp in employees:
            profiles[emp.id] = {
                'punctuality': random.gauss(0.0, 1.0),   # negative = tends to be late
                'diligence': random.gauss(0.0, 1.0),     # positive = tends to stay late / OT
                'reliability': random.uniform(0.80, 0.98),  # attendance probability
            }

        self.stdout.write(f'  Generating {num_days} days of attendance ({base_date} → {today})...')

        for day_offset in range(num_days):
            current_date = base_date + timedelta(days=day_offset)
            weekday = current_date.weekday()  # 0=Mon, 6=Sun

            # Nepal: Sunday is working, Saturday is off, some offices half-day Sat
            is_sunday_off = False  # Sunday is a normal working day in Nepal
            is_saturday = weekday == 5  # Saturday is the weekly off

            if is_saturday:
                # Some Saturdays might be working (government alternating schedule)
                if random.random() < 0.85:
                    continue  # Skip most Saturdays
                # On working Saturdays, fewer people show up
                saturday_attendance_rate = 0.4
            else:
                saturday_attendance_rate = None

            stats['working_days'] += 1

            event_batch = []
            summary_batch = []

            for emp in employees:
                emp_profile = profiles[emp.id]

                # Determine presence
                base_rate = emp_profile['reliability']
                if saturday_attendance_rate is not None:
                    attend_rate = saturday_attendance_rate * base_rate
                else:
                    attend_rate = base_rate

                # Today: ensure high presence for demo purposes
                is_today = current_date == today
                if is_today:
                    attend_rate = max(attend_rate, 0.92)

                present = random.random() < attend_rate

                if not present:
                    stats['absent'] += 1
                    # Create absent summary
                    bs_date = self._compute_bs_date(current_date)
                    summary_batch.append(DailyAttendance(
                        employee=emp,
                        attendance_date=current_date,
                        attendance_date_bs=bs_date,
                        present=False,
                        worked_minutes=0,
                    ))
                    continue

                # Build attendance events for this employee-day
                result = self._build_day_events(
                    emp, current_date, emp_profile,
                    is_today=is_today,
                    is_saturday=(saturday_attendance_rate is not None),
                )

                stats['present'] += 1
                stats['late'] += int(result['late'])
                stats['early'] += int(result['early_departure'])
                stats['overtime'] += int(result['has_ot'])
                stats['events'] += len(result['events'])

                event_batch.extend(result['events'])
                summary_batch.append(result['summary'])

            # Bulk insert
            if event_batch:
                AttendanceEvent.objects.bulk_create(event_batch, batch_size=2000)
            if summary_batch:
                DailyAttendance.objects.bulk_create(
                    summary_batch, batch_size=2000, ignore_conflicts=True
                )

            # Progress indicator
            if (day_offset + 1) % 30 == 0 or day_offset == num_days - 1:
                self.stdout.write(f'    ... day {day_offset + 1}/{num_days} ({current_date})')

        return stats

    def _build_day_events(self, employee, attendance_date, profile, is_today=False, is_saturday=False):
        """Build realistic attendance events for one employee on one day."""
        dept = employee.department
        arrival_time = getattr(dept, 'arrival_time', time(9, 0)) or time(9, 0)
        departure_time = getattr(dept, 'departure_time', time(18, 0)) or time(18, 0)

        # ── Check-in time ──────────────────────────────────────────
        punctuality = profile['punctuality']
        # Base: arrive within ±30 min of scheduled time
        # punctuality < 0 means tends late; > 0 means tends early
        offset_minutes = int(random.gauss(-punctuality * 10, 12))
        check_in_dt = timezone.make_aware(
            datetime.combine(attendance_date, arrival_time)
        ) + timedelta(minutes=offset_minutes)

        late = check_in_dt > timezone.make_aware(
            datetime.combine(attendance_date, arrival_time)
        )

        # ── Check-out time ─────────────────────────────────────────
        diligence = profile['diligence']
        # Stay longer if diligent; base ±20 min around departure
        depart_offset = int(random.gauss(diligence * 8, 15))
        if is_saturday:
            # Half-day Saturday: depart around 13:00
            check_out_dt = timezone.make_aware(
                datetime.combine(attendance_date, time(13, 0))
            ) + timedelta(minutes=random.randint(-15, 30))
        else:
            check_out_dt = timezone.make_aware(
                datetime.combine(attendance_date, departure_time)
            ) + timedelta(minutes=depart_offset)

        scheduled_departure_dt = timezone.make_aware(
            datetime.combine(attendance_date, departure_time)
        )
        early_departure = check_out_dt < scheduled_departure_dt and not is_saturday

        # Ensure check_out > check_in
        if check_out_dt <= check_in_dt:
            check_out_dt = check_in_dt + timedelta(hours=7)

        # ── Break ──────────────────────────────────────────────────
        # Break somewhere in the middle
        work_span = (check_out_dt - check_in_dt).total_seconds()
        break_start_offset = random.uniform(0.35, 0.55) * work_span
        break_out_dt = check_in_dt + timedelta(seconds=break_start_offset)
        break_duration = random.randint(20, 50)
        break_in_dt = break_out_dt + timedelta(minutes=break_duration)

        if break_in_dt >= check_out_dt:
            break_in_dt = check_out_dt - timedelta(minutes=30)
        if break_out_dt >= break_in_dt:
            break_out_dt = break_in_dt - timedelta(minutes=25)

        # Sometimes add a second break (15% chance)
        extra_breaks = []
        if random.random() < 0.15 and not is_saturday:
            second_break_out = break_in_dt + timedelta(
                hours=random.randint(1, 2), minutes=random.randint(0, 30)
            )
            second_break_in = second_break_out + timedelta(minutes=random.randint(10, 25))
            if second_break_in < check_out_dt - timedelta(minutes=30):
                extra_breaks = [
                    (AttendanceEvent.BREAK_OUT, second_break_out),
                    (AttendanceEvent.BREAK_IN, second_break_in),
                ]
                break_duration += int((second_break_in - second_break_out).total_seconds() / 60)

        # ── Overtime ───────────────────────────────────────────────
        has_ot = False
        ot_in_dt = None
        ot_out_dt = None
        if not is_saturday and diligence > 0.3 and random.random() < 0.25:
            has_ot = True
            ot_in_dt = max(check_out_dt, scheduled_departure_dt) + timedelta(minutes=random.randint(5, 20))
            ot_minutes = random.randint(30, 120)
            ot_out_dt = ot_in_dt + timedelta(minutes=ot_minutes)

        # ── Build event list ───────────────────────────────────────
        events = [
            AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.CHECK_IN,
                event_time=check_in_dt,
                device_serial='ZK-MAIN-001',
                source='device',
            ),
            AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.BREAK_OUT,
                event_time=break_out_dt,
                device_serial='ZK-MAIN-001',
                source='device',
            ),
            AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.BREAK_IN,
                event_time=break_in_dt,
                device_serial='ZK-MAIN-001',
                source='device',
            ),
        ]

        for evt_type, evt_time in extra_breaks:
            events.append(AttendanceEvent(
                employee=employee,
                event_type=evt_type,
                event_time=evt_time,
                device_serial='ZK-MAIN-001',
                source='device',
            ))

        # For today, some employees may not have checked out yet
        if is_today and random.random() < 0.3:
            # Still at work — no checkout yet
            last_event_type = events[-1].event_type
            last_event_time = events[-1].event_time
            worked_so_far = (timezone.now() - check_in_dt).total_seconds() / 60
            worked_minutes = max(0, int(worked_so_far - break_duration))
            check_out_dt = None
        else:
            events.append(AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.CHECK_OUT,
                event_time=check_out_dt,
                device_serial='ZK-MAIN-001',
                source='device',
            ))
            last_event_type = AttendanceEvent.CHECK_OUT
            last_event_time = check_out_dt

            total_minutes = (check_out_dt - check_in_dt).total_seconds() / 60
            worked_minutes = max(0, int(total_minutes - break_duration))

        if has_ot and ot_in_dt and ot_out_dt:
            events.append(AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.OT_IN,
                event_time=ot_in_dt,
                device_serial='ZK-MAIN-001',
                source='device',
            ))
            events.append(AttendanceEvent(
                employee=employee,
                event_type=AttendanceEvent.OT_OUT,
                event_time=ot_out_dt,
                device_serial='ZK-MAIN-001',
                source='device',
            ))
            ot_minutes = int((ot_out_dt - ot_in_dt).total_seconds() / 60)
            worked_minutes += ot_minutes
            last_event_type = AttendanceEvent.OT_OUT
            last_event_time = ot_out_dt

        # ── Build summary ──────────────────────────────────────────
        bs_date = self._compute_bs_date(attendance_date)

        summary = DailyAttendance(
            employee=employee,
            attendance_date=attendance_date,
            attendance_date_bs=bs_date,
            first_check_in=check_in_dt,
            last_check_out=check_out_dt,
            first_ot_in=ot_in_dt,
            last_ot_out=ot_out_dt,
            worked_minutes=max(0, worked_minutes),
            present=True,
            last_event_type=last_event_type,
            last_event_time=last_event_time,
        )

        return {
            'events': events,
            'summary': summary,
            'late': late,
            'early_departure': early_departure,
            'has_ot': has_ot,
        }

    def _compute_bs_date(self, ad_date):
        """Convert AD date to BS and return as a date object for the BS field."""
        try:
            from attendance.date_utils import ad_to_bs
            y, m, d = ad_to_bs(ad_date)
            return _date(int(y), int(m), int(d))
        except Exception:
            return None
