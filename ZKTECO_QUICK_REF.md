# ZKTeco Device Sync - Quick Reference

## What Was Built

A complete ZKTeco ADMS protocol integration allowing biometric devices to:
1. Auto-register when connecting to your server
2. Poll for pending user sync commands
3. Execute those commands and acknowledge completion

## Models Added/Updated

### `DeviceCommand` (NEW)
```
device (FK→BiometricDevice)
user_id (CharField)
name (CharField)
status (pending|done|failed)
created_at, updated_at
```

### `BiometricDevice` (UPDATED)
Added `location` field for physical device location

## Endpoints Summary

### Device Communication (ADMS Protocol)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/iclock/cdata` | Device handshake & auto-register |
| GET | `/iclock/getrequest` | Device polls for pending commands |
| POST | `/iclock/devicecmd` | Device acknowledges command done |

### Frontend API (DRF/JSON)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/commands/` | Create pending command |
| GET | `/api/devices/` | List devices & status |

## Creating a Command (Frontend)

```bash
curl -X POST http://localhost:8000/api/commands/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "device_serial_number": "AB123456",
    "user_id": "1001",
    "name": "John Doe"
  }'
```

Response:
```json
{
  "id": 42,
  "device": 1,
  "user_id": "1001",
  "name": "John Doe",
  "status": "pending",
  "created_at": "2025-05-05T10:30:00Z",
  "updated_at": "2025-05-05T10:30:00Z"
}
```

## Getting Devices (Frontend)

```bash
curl http://localhost:8000/api/devices/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Returns device list with `last_seen_at` (for checking if online)

## Device Flow

```
Device                          Server
  |                               |
  +--GET /iclock/cdata?SN=ABC-->  | [Auto-register if needed]
  |<--GET OPTION FROM: ABC-------+
  |                               |
  +--GET /iclock/getrequest?SN--> | [Check for pending commands]
  |                               |
  |<--C:42:DATA UPDATE USERINFO...| [Pending command found]
  |                               |
  | [Execute command on device]   |
  |                               |
  +--POST /iclock/devicecmd?SN---> | [Acknowledge completion]
  | [Body: C:42:...]              |
  |<--OK------------------------+ | [Mark as done]
```

## Database Changes

Migration `0008_biometricdevice_location_devicecommand.py` applied:
- ✅ Added `location` field to `BiometricDevice`
- ✅ Created `DeviceCommand` table with proper indexes

## Code Files Modified

1. **enterprise/models.py**
   - Added `DeviceCommand` model
   - Added `location` field to `BiometricDevice`

2. **enterprise/serializers.py**
   - Added `DeviceCommandSerializer` (read)
   - Added `CreateDeviceCommandSerializer` (write)

3. **enterprise/views.py**
   - Added ADMS endpoints (3 functions)
   - Added DRF endpoints (2 classes)

4. **enterprise/urls.py**
   - Registered all 5 new endpoints

## Key Features

✅ **Auto-Registration:** Devices auto-register when they first connect
✅ **Status Tracking:** See which devices are online via `last_seen_at`
✅ **Command Queue:** Unlimited pending commands per device
✅ **Atomic Ops:** Status updates are atomic
✅ **Optimized Queries:** Indexed for fast polling even with many commands
✅ **Plain Text Protocol:** ADMS endpoints return plain text (not JSON)
✅ **CSRF Disabled:** Devices don't send CSRF tokens
✅ **No Bridge Needed:** Device connects directly to your server

## Testing

### Simulate Device Handshake
```bash
curl "http://localhost:8000/iclock/cdata?SN=TEST123"
# Response: GET OPTION FROM: TEST123
```

### Simulate Command Polling
```bash
curl "http://localhost:8000/iclock/getrequest?SN=TEST123"
# Response: OK (or C:42:DATA UPDATE USERINFO PIN=...)
```

### Simulate Command Acknowledgement
```bash
curl -X POST "http://localhost:8000/iclock/devicecmd?SN=TEST123" \
  -d "C:42:data"
# Response: OK
```

## Next Steps

1. **Configure Your Device:**
   - Set device server URL to your Django app
   - Device will auto-register on first connection

2. **Add UI in Frontend:**
   - Form to enter device serial, user ID, name
   - Call `POST /api/commands/`
   - List devices with `GET /api/devices/`
   - Show online/offline status

3. **Move to PostgreSQL:**
   - Update `settings.py` database config
   - Install `psycopg2-binary`
   - Run `python manage.py migrate`

4. **Production Hardening:**
   - Add device API key authentication
   - Implement request signing
   - Add rate limiting
   - Enable request/response logging

## Documentation

Full guide available in `ZKTECO_SYNC_GUIDE.md`
