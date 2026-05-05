# ZKTeco Biometric Device Sync Implementation

This document describes the ZKTeco ADMS protocol integration for syncing users to biometric attendance devices.

## Overview

The system allows you to:
1. Register biometric devices in your dashboard
2. Send commands from your web app to add/update users on those devices
3. Devices poll your server for pending commands using the ZKTeco ADMS protocol
4. Devices acknowledge commands when processed

## Architecture

### Data Models

#### `BiometricDevice`
Represents a physical ZKTeco biometric device.

Fields:
- `serial_number` (CharField, unique) - Device serial number
- `name` (CharField) - User-friendly device name
- `location` (CharField) - Physical location of the device
- `device_ip` (CharField, optional) - Device IP address (for legacy ZK SDK support)
- `device_port` (PositiveIntegerField) - Device port (default: 4370)
- `device_model` (CharField) - Device model identifier
- `is_active` (BooleanField) - Whether the device is active
- `last_seen_at` (DateTimeField) - Last time device contacted the server
- `created_at` (DateTimeField) - Creation timestamp
- `enterprise` (ForeignKey) - Associated enterprise
- `branch` (ForeignKey) - Associated branch

#### `DeviceCommand`
Represents a command to be executed on a device (e.g., add user).

Fields:
- `device` (ForeignKey to BiometricDevice) - Target device
- `user_id` (CharField) - User ID on the device (PIN)
- `name` (CharField) - User name to sync to device
- `status` (CharField) - Command status: 'pending', 'done', 'failed'
- `created_at` (DateTimeField) - When command was created
- `updated_at` (DateTimeField) - Last update timestamp

Status flow:
- `pending` → Device polls and retrieves the command
- `done` → Device executes and acknowledges the command
- `failed` → Command failed to execute (manual intervention may be needed)

## Communication Flow

### 1. Device Registration (Auto-Discovery)

**Request from Device:**
```
GET /iclock/cdata?SN=AB123456
```

**Response from Server:**
```
GET OPTION FROM: AB123456
```

**What happens:**
- Device sends handshake request with its serial number
- Server checks if device exists in database
- If not, server creates new device record automatically
- Server updates `last_seen_at` timestamp
- Device receives confirmation and continues

### 2. Command Polling (Device → Server)

**Request from Device (periodic):**
```
GET /iclock/getrequest?SN=AB123456
```

**Response if pending command exists:**
```
C:42:DATA UPDATE USERINFO PIN=1001\tName=John Doe\tPri=0\tPasswd=\tCard=\t
```

**Response if no pending commands:**
```
OK
```

**What happens:**
- Device polls for pending commands
- Server queries database for pending commands for this device
- If found, returns command in ZKTeco ADMS format with:
  - Command ID (for acknowledgement)
  - User PIN (from `user_id`)
  - User name
  - Default settings (Pri=0, empty password)
- Device parses and executes the command

### 3. Command Acknowledgement (Device → Server)

**Request from Device:**
```
POST /iclock/devicecmd?SN=AB123456
Body: C:42:...
```

**Response:**
```
OK
```

**What happens:**
- Device acknowledges completion of command ID 42
- Server parses command ID from request body
- Server marks command as `done` in database
- Next poll will return a different command

## API Endpoints

### DRF Endpoints (Frontend Integration)

#### POST `/api/commands/`
Create a new pending command for a device.

**Request:**
```json
{
  "device_serial_number": "AB123456",
  "user_id": "1001",
  "name": "John Doe"
}
```

**Response (201):**
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

**Authentication:** Required (IsAuthenticated)

#### GET `/api/devices/`
Get list of all biometric devices with their status.

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Entrance",
    "serial_number": "AB123456",
    "location": "Building A",
    "device_ip": "192.168.1.100",
    "device_port": 4370,
    "device_model": "K40",
    "enterprise": 1,
    "branch": 1,
    "is_active": true,
    "last_seen_at": "2025-05-05T10:35:00Z",
    "created_at": "2025-05-05T08:00:00Z"
  }
]
```

**Authentication:** Required (IsAuthenticated)

### ADMS Endpoints (Device Integration)

#### GET `/iclock/cdata`
Device handshake and registration.

**Query Parameters:**
- `SN` - Device serial number

**Returns:**
- `200 OK`: `GET OPTION FROM: <SN>`
- `400 BAD REQUEST`: `ERROR` (if SN not provided)

**CSRF:** Disabled (devices don't send CSRF tokens)

#### GET `/iclock/getrequest`
Device polls for pending commands.

**Query Parameters:**
- `SN` - Device serial number

**Returns:**
- `200 OK`: Command in format `C:<id>:DATA UPDATE USERINFO PIN=<pin>\tName=<name>\tPri=0\tPasswd=\tCard=\t`
- `200 OK`: `OK` (if no pending commands)
- `400 BAD REQUEST`: `ERROR` (if SN invalid)

**CSRF:** Disabled

#### POST `/iclock/devicecmd`
Device acknowledges command completion.

**Query Parameters:**
- `SN` - Device serial number

**Request Body:**
- `C:<command_id>:...` (ZKTeco format)

**Returns:**
- `200 OK`: `OK` (command marked as done)
- `400 BAD REQUEST`: `ERROR` (invalid format or command not found)

**CSRF:** Disabled

## Frontend Integration Example

```javascript
// Create a new command to sync user to device
async function syncUserToDevice(serialNumber, userId, userName) {
  const response = await fetch('/api/commands/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      device_serial_number: serialNumber,
      user_id: userId,
      name: userName,
    }),
  });
  
  if (response.ok) {
    const command = await response.json();
    console.log('Command created:', command);
    return command;
  }
  throw new Error('Failed to create command');
}

// Get list of available devices
async function getDevices() {
  const response = await fetch('/api/devices/', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (response.ok) {
    const devices = await response.json();
    return devices;
  }
  throw new Error('Failed to fetch devices');
}
```

## Device Configuration

For your ZKTeco device, configure:

1. **Device IP/Hostname:** Your server's IP/domain
2. **Device Port:** `4370` (default) or your configured port
3. **Push Server URL:** `http://your-server:8000/iclock/` (without trailing paths)
4. **Command URL:** `http://your-server:8000/iclock/getrequest`

The device will automatically:
- Register itself when it first connects
- Poll for commands periodically (usually every 30 seconds)
- Acknowledge commands after processing

## Status Monitoring

From your frontend dashboard, you can:

1. **Check Device Status:**
   - Call `GET /api/devices/`
   - Check `last_seen_at` to see if device is online
   - Check `is_active` flag

2. **Monitor Commands:**
   - Query `DeviceCommand` model for pending/done/failed commands
   - Track which users have been synced to which devices

3. **Set Online/Offline Indicators:**
   - If `last_seen_at` is within last 5 minutes → Online
   - Otherwise → Offline

## Database Schema Notes

### Indexes
For performance, the following indexes are created:

```python
DeviceCommand:
  - Index on (device, status) - for polling pending commands
  - Index on (status, -created_at) - for listing recent commands
```

This ensures device polling queries are fast even with many commands.

## Migration Information

The feature adds:
1. `DeviceCommand` table
2. `location` field to `BiometricDevice` table

Migration file: `enterprise/migrations/0008_biometricdevice_location_devicecommand.py`

Apply with:
```bash
python manage.py migrate
```

## Error Handling

### Device Not Found
- `AdmsGetDataCommand` and other ADMS endpoints return `ERROR` if device `SN` is invalid

### Invalid Command Format
- If device sends malformed command ID, endpoint returns `ERROR`

### Missing Required Fields
- Frontend endpoints validate required fields and return `400 BAD REQUEST` with error details

## PostgreSQL Migration

When moving to PostgreSQL (for production):

1. Update `settings.py`:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'ezihr',
        'USER': 'postgres',
        'PASSWORD': '...',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

2. Install PostgreSQL driver:
```bash
pip install psycopg2-binary
```

3. Run migrations:
```bash
python manage.py migrate
```

All existing migrations will apply unchanged.

## Security Considerations

1. **ADMS Endpoints:** CSRF is disabled for device communication (they don't send CSRF tokens)
2. **Device Authentication:** Currently trusts device serial number
   - Consider adding device token/API key for production
3. **Command Validation:** Device serial must exist in database
4. **Frontend Auth:** DRF endpoints require authentication

For production, consider:
- Adding device API keys instead of relying only on serial number
- Implementing request signing/verification
- Rate limiting on ADMS endpoints
- Logging all device communications for audit

## Troubleshooting

### Device Not Registering
- Check if device can reach your server (test with `curl`)
- Verify server URL configured in device matches your endpoint
- Check server logs for connection attempts

### Commands Not Executing
- Verify command is in 'pending' status in database
- Check device `last_seen_at` to ensure it's polling
- Ensure device has enough memory for new users
- Check device logs for parsing errors

### Server Integration
- Check Django logs for any errors in ADMS endpoint handling
- Verify `DeviceCommand` records are being created
- Monitor `BiometricDevice.last_seen_at` to track device health
