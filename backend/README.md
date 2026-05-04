# EziHR Attendance Backend

This Django backend now includes:

- an authenticated attendance dashboard for staff/admin users,
- biometric device endpoints for `iclock/cdata` and `iclock/getrequest`,
- automatic biometric device registration on first heartbeat/data sync,
- per-device employee mapping so device user IDs can repeat across offices,
- daily attendance aggregation that keeps the earliest check-in and latest check-out,
- break and overtime event tracking,
- a searchable Django admin for staff, events, and daily summaries.

## Key endpoints

- `/attendance/login/` - admin/staff login
- `/attendance/dashboard/` - daily attendance dashboard
- `/iclock/cdata/` - biometric punch endpoint
- `/iclock/getrequest/` - device heartbeat endpoint

## Event codes

- `0` = Check-In
- `1` = Check-Out
- `2` = Break-Out
- `3` = Break-In
- `4` = OT-In
- `5` = OT-Out

## Run

```bash
/home/bibhab/EziHR/backend/.venv/bin/python manage.py makemigrations
/home/bibhab/EziHR/backend/.venv/bin/python manage.py migrate
/home/bibhab/EziHR/backend/.venv/bin/python manage.py runserver 0.0.0.0:8000
```
