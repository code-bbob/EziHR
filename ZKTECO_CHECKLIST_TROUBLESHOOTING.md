# ZKTeco Implementation Checklist & Troubleshooting

## Implementation Checklist

### Backend Setup ✅ (DONE)

- [x] Add `DeviceCommand` model to `enterprise/models.py`
- [x] Add `location` field to `BiometricDevice`
- [x] Create ADMS protocol endpoints:
  - [x] `GET /iclock/cdata` - Device handshake
  - [x] `GET /iclock/getrequest` - Command polling
  - [x] `POST /iclock/devicecmd` - Command acknowledgement
- [x] Create DRF endpoints:
  - [x] `POST /api/commands/` - Create pending command
  - [x] `GET /api/devices/` - List devices
- [x] Add serializers: `DeviceCommandSerializer`, `CreateDeviceCommandSerializer`
- [x] Update URL routing in `enterprise/urls.py`
- [x] Create and apply database migration
- [x] Verify Django checks pass

### Frontend Setup (TODO)

- [ ] Add API client functions in `lib/api-client.ts`
- [ ] Create `DeviceList` component
- [ ] Create `useDeviceSync` hook (optional)
- [ ] Add device list to dashboard
- [ ] Test creating commands
- [ ] Add error handling UI
- [ ] Add loading states

### Device Configuration (TODO)

- [ ] Configure device server URL
- [ ] Configure push server settings
- [ ] Test device can reach your server
- [ ] Verify device can parse commands

### Testing (TODO)

- [ ] Test device auto-registration (GET /iclock/cdata)
- [ ] Test command polling (GET /iclock/getrequest)
- [ ] Test command acknowledgement (POST /iclock/devicecmd)
- [ ] Test frontend command creation (POST /api/commands/)
- [ ] Test device list (GET /api/devices/)
- [ ] Test end-to-end user sync flow

## Verification Steps

### 1. Database Migration Verification

```bash
cd backend
source env/bin/activate
python manage.py showmigrations enterprise
# Should show: [X] 0008_biometricdevice_location_devicecommand
```

### 2. Django Checks

```bash
python manage.py check
# Should output: System check identified no issues (0 silenced).
```

### 3. URL Routing Verification

```bash
python manage.py show_urls | grep -E "(iclock|commands|devices)"
# Should show:
# /iclock/cdata
# /iclock/getrequest
# /iclock/devicecmd
# /api/commands/
# /api/devices/
```

### 4. Model Verification

```bash
python shell
from enterprise.models import DeviceCommand, BiometricDevice
print(DeviceCommand._meta.fields)
print(BiometricDevice._meta.fields)
# Verify location field exists
```

## Troubleshooting Guide

### Issue: "Module not found" or "ImportError"

**Problem:** `from enterprise.models import DeviceCommand` fails

**Solution:**
1. Ensure migration is applied: `python manage.py migrate`
2. Clear Python cache: `find . -type d -name __pycache__ -exec rm -r {} +`
3. Restart Django server

### Issue: Device Can't Connect to Server

**Symptoms:**
- Device doesn't appear in database
- `last_seen_at` is never updated

**Debugging:**
1. Test from your server:
```bash
curl "http://localhost:8000/iclock/cdata?SN=TEST123"
# Should return: GET OPTION FROM: TEST123
```

2. Test from device network (if possible):
```bash
# From device or device network
curl "http://YOUR_SERVER_IP:8000/iclock/cdata?SN=TEST123"
```

3. Check firewall:
   - Is port 8000 open?
   - Is port 4370 open (if device tries to connect back)?

4. Check server IP:
   - Device must use correct IP/domain
   - Can't use localhost if device is remote
   - Use public IP or domain

5. Check Django logs:
```bash
# Run in debug mode to see logs
python manage.py runserver 0.0.0.0:8000
```

### Issue: Device Registers but Won't Poll Commands

**Symptoms:**
- Device appears in database with recent `last_seen_at`
- Commands stay in `pending` status forever

**Debugging:**
1. Check if device is polling:
```bash
# In Django shell
from enterprise.models import BiometricDevice, DeviceCommand
device = BiometricDevice.objects.get(serial_number='AB123456')
print(f"Last seen: {device.last_seen_at}")
commands = DeviceCommand.objects.filter(device=device, status='pending')
print(f"Pending commands: {commands.count()}")
```

2. Manual test:
```bash
curl "http://localhost:8000/iclock/getrequest?SN=AB123456"
# Should return:
# - Command format: C:42:DATA UPDATE USERINFO PIN=...
# - Or: OK (if no pending)
```

3. Check command format:
   - Must have correct tab separators (`\t`)
   - PIN must be numeric string
   - Name must be valid UTF-8

### Issue: Commands Created but Not Executed

**Symptoms:**
- Command status is `pending`
- Device shows online
- But user doesn't appear on device

**Debugging:**
1. Check command in database:
```bash
python manage.py shell
from enterprise.models import DeviceCommand
cmd = DeviceCommand.objects.latest('id')
print(f"ID: {cmd.id}")
print(f"User ID: {cmd.user_id}")
print(f"Name: {cmd.name}")
print(f"Status: {cmd.status}")
print(f"Device: {cmd.device.serial_number}")
```

2. Check if command is being returned to device:
```bash
curl "http://localhost:8000/iclock/getrequest?SN=DEVICE_SN"
# Should show your command
```

3. Device capacity issues:
   - Device may be full (max users reached)
   - Device may not have enough memory
   - Check device logs/admin panel

4. Device settings:
   - User privilege (Pri) must be valid
   - Name length must be acceptable
   - PIN must be unique on device

### Issue: Command Acknowledged but Status Stays "Pending"

**Symptoms:**
- Device sends acknowledgement
- Status doesn't change to `done`

**Debugging:**
1. Check device acknowledgement format:
```bash
# Device should POST with body: C:COMMAND_ID:...
# For example: C:42:...

# Test manually:
curl -X POST "http://localhost:8000/iclock/devicecmd?SN=AB123456" \
  -d "C:42:something"
# Should return: OK
```

2. Check if command ID is correct:
```bash
python manage.py shell
from enterprise.models import DeviceCommand
cmd = DeviceCommand.objects.get(id=42)
print(f"Status before: {cmd.status}")
# Create command manually
cmd.status = 'done'
cmd.save()
print(f"Status after: {cmd.status}")
```

3. Check server logs for parsing errors:
   - Body might have extra characters
   - Command ID might be malformed
   - Check request encoding

### Issue: "ERROR" Response from Device Endpoints

**Problem:** Device receives "ERROR" responses

**Causes and solutions:**

1. **Missing SN parameter:**
```bash
curl "http://localhost:8000/iclock/cdata"  # ❌ Missing SN
curl "http://localhost:8000/iclock/cdata?SN=ABC"  # ✅ Correct
```

2. **Invalid serial number format:**
   - Ensure serial number matches exactly
   - Check for spaces or special characters
   - Device SN should be alphanumeric

3. **POST/GET mismatch:**
   - `/iclock/cdata` → GET only
   - `/iclock/getrequest` → GET only
   - `/iclock/devicecmd` → POST only

4. **Network issues:**
   - Check request reaches server (check logs)
   - Verify JSON/form encoding
   - Check for request timeouts

### Issue: "Device not found" from Frontend API

**Problem:** Creating command returns 400 error

**Solution:**
1. Ensure device exists and serial is correct:
```bash
python manage.py shell
from enterprise.models import BiometricDevice
BiometricDevice.objects.filter(serial_number='AB123456').first()
# Should return device object, not None
```

2. Device must have called `/iclock/cdata` first
   - Or manually create device in admin:
   ```bash
   python manage.py shell
   from enterprise.models import BiometricDevice
   device = BiometricDevice.objects.create(
       serial_number='TEST123',
       name='Test Device',
       is_active=True
   )
   ```

3. Serial number case sensitivity
   - Serial numbers should match exactly
   - Check for case differences

### Issue: PostgreSQL Migration Issues

**Problem:** After switching to PostgreSQL, tests fail

**Solution:**
1. Ensure psycopg2 is installed:
```bash
pip install psycopg2-binary
```

2. Update database config in `settings.py`:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'ezihr',
        'USER': 'postgres',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

3. Create database and run migrations:
```bash
createdb ezihr
python manage.py migrate
```

4. All existing migrations apply automatically

## Performance Optimization

### For High Command Volume

1. **Add database index on device status:**
```python
# Already done in migration!
models.Index(fields=['device', 'status']),
models.Index(fields=['status', '-created_at']),
```

2. **Add connection pooling** (for PostgreSQL):
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'CONN_MAX_AGE': 600,
        # ... other settings
    }
}
```

3. **Cache device list:**
```python
from django.views.decorators.cache import cache_page

@cache_page(60)  # Cache for 60 seconds
def list_devices_cached(request):
    # ...
```

## Common Configuration Issues

### Device URL Configuration

**Wrong:**
```
http://my-server.com/iclock/getrequest?SN=ABC  # Device polls this
```

**Correct:**
```
Server URL: http://my-server.com
Push URL: http://my-server.com/iclock/cdata
Command URL: http://my-server.com/iclock/getrequest
Callback URL: http://my-server.com/iclock/devicecmd
```

### CORS Issues

If device is in different domain:
- CORS is already configured in your settings
- ADMS endpoints have `@csrf_exempt`
- Should work cross-domain

## Next Steps

1. **Frontend Integration:** See `FRONTEND_ZKTECO_INTEGRATION.md`
2. **Full Documentation:** See `ZKTECO_SYNC_GUIDE.md`
3. **Quick Reference:** See `ZKTECO_QUICK_REF.md`

## Getting Help

If you encounter issues:

1. Check Django logs: `tail -f your.log`
2. Check device logs: Check device admin panel
3. Test endpoints manually with curl (examples above)
4. Check database directly with Django shell
5. Verify network connectivity between device and server

## Production Deployment

Before going to production:

1. [ ] Switch to PostgreSQL
2. [ ] Enable HTTPS/SSL
3. [ ] Add device API key authentication
4. [ ] Enable request logging
5. [ ] Set up monitoring for device connections
6. [ ] Configure rate limiting
7. [ ] Test end-to-end sync flow
8. [ ] Document all custom settings
