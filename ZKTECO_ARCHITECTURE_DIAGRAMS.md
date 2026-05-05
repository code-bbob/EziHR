# ZKTeco System Architecture Diagrams

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Your EziHR System                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────┐                  ┌──────────────────────┐  │
│  │   Next.js Frontend   │                  │   Django Backend     │  │
│  │  (React Component)   │                  │  (REST API)          │  │
│  │                      │                  │                      │  │
│  │ - Device List View   │───POST────────►│ /api/commands/       │  │
│  │ - Sync User Form     │   /api/commands │ (Create command)     │  │
│  │ - Online Status      │                 │                      │  │
│  │ - Command History    │◄────JSON────────│ /api/devices/        │  │
│  │                      │  (DeviceList)   │ (List devices)       │  │
│  └──────────────────────┘                 │                      │  │
│                                            │ ┌──────────────────┐ │  │
│                                            │ │  PostgreSQL      │ │  │
│                                            │ │  - Devices       │ │  │
│                                            │ │  - Commands      │ │  │
│                                            │ │  - Employees     │ │  │
│                                            │ └──────────────────┘ │  │
│                                            └──────────────────────┘  │
│                                                    ▲                 │
│                                                    │                 │
│                         ADMS Protocol             │                 │
│                      (Plain Text TCP)             │                 │
│                                                    │                 │
└────────────────────────────────────────────────────┼─────────────────┘
                                                     │
                    ┌────────────────────────────────┼────────────────────────┐
                    │                                │                        │
         ┌──────────▼──────────┐        ┌──────────▼──────────┐   ┌────────▼──────────┐
         │   Biometric Device  │        │   Biometric Device  │   │ Biometric Device   │
         │   (Building A)      │        │   (Building B)      │   │ (Building C)       │
         │   Serial: AB123456  │        │   Serial: CD789012  │   │ Serial: EF345678   │
         │                     │        │                     │   │                    │
         │ Polls every 30s:    │        │ Polls every 30s:    │   │ Polls every 30s:   │
         │ 1. GET /cdata       │        │ 1. GET /cdata       │   │ 1. GET /cdata      │
         │ 2. GET /getrequest  │        │ 2. GET /getrequest  │   │ 2. GET /getrequest │
         │ 3. POST /devicecmd  │        │ 3. POST /devicecmd  │   │ 3. POST /devicecmd │
         │                     │        │                     │   │                    │
         │ Physical Features:  │        │ Physical Features:  │   │ Physical Features: │
         │ - Fingerprint scan  │        │ - Fingerprint scan  │   │ - Fingerprint scan │
         │ - Face recognition  │        │ - Face recognition  │   │ - Face recognition │
         │ - RFID card support │        │ - RFID card support │   │ - RFID card support│
         └─────────────────────┘        └─────────────────────┘   └────────────────────┘
```

## Device Registration & Polling Flow

```
                    Device Power-On or Periodic Interval
                              │
                              ▼
            ┌─────────────────────────────┐
            │  1. HANDSHAKE               │
            │  GET /iclock/cdata?SN=ABC   │
            └─────────────────────────────┘
                      │
                      ▼
            ┌─────────────────────────────┐
            │  Server Response:           │
            │  GET OPTION FROM: ABC       │
            │                             │
            │  [Device auto-registers    │
            │   in DB if needed]          │
            │  [Update last_seen_at]      │
            └─────────────────────────────┘
                      │
                      ▼
            ┌─────────────────────────────┐
            │  2. COMMAND POLLING         │
            │  GET /iclock/getrequest     │
            │  ?SN=ABC                    │
            └─────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────┐
        │  Check: Are there pending       │
        │         commands for this       │
        │         device?                 │
        └─────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
   YES: Pending            NO: No pending
   Command Found            Commands
        │                            │
        ▼                            ▼
   C:42:DATA UPDATE      ┌──────────────────┐
   USERINFO              │  Response: OK    │
   PIN=1001\t            │                  │
   Name=John\t           │  [Device waits   │
   Pri=0\t               │   for next       │
   Passwd=\t             │   polling cycle] │
   Card=\t               └──────────────────┘
        │
        ▼
   [Device processes
    command locally]
   [Adds user 1001
    to device]
        │
        ▼
   ┌──────────────────────────────────┐
   │  3. COMMAND ACKNOWLEDGEMENT      │
   │  POST /iclock/devicecmd?SN=ABC   │
   │  Body: C:42:success              │
   └──────────────────────────────────┘
        │
        ▼
   Server marks command as 'done'
   in database
        │
        ▼
   Next polling cycle will show
   different command or OK

```

## Frontend Integration Flow

```
User Interface (Next.js)
│
├─────────────────────────────────────────┐
│  Device List Component                  │
│  ┌──────────────────────────────────┐   │
│  │ Device: Entrance (AB123456)      │   │
│  │ Location: Building A              │   │
│  │ Status: 🟢 Online                 │   │
│  │ Last seen: 2 minutes ago          │   │
│  │                                   │   │
│  │ ┌─ Sync User Form ───────────┐   │   │
│  │ │ User ID:  [1001       ]    │   │   │
│  │ │ Name:     [John Doe   ]    │   │   │
│  │ │ [Sync User] [Loading...]   │   │   │
│  │ └───────────────────────────┘   │   │
│  └──────────────────────────────────┘   │
│                                         │
│  [Refresh] [Logs] [Settings]            │
└─────────────────────────────────────────┘
                │
                │ POST /api/commands/
                │ {
                │   device_serial_number: "AB123456"
                │   user_id: "1001"
                │   name: "John Doe"
                │ }
                ▼
            ┌──────────────────┐
            │  Django Backend  │
            │  - Validate      │
            │  - Create record │
            │  - Return JSON   │
            └──────────────────┘
                │
                │ Response:
                │ {
                │   id: 42
                │   status: "pending"
                │   created_at: "..."
                │ }
                ▼
        ┌─────────────────────┐
        │  Command Created! ✓  │
        │  Waiting for device  │
        │  to poll...          │
        └─────────────────────┘
                │
                │ Next device poll
                ▼
        ┌──────────────────────────┐
        │  Device receives command │
        │  and executes it         │
        └──────────────────────────┘
```

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Database                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────┐       ┌──────────────────────────┐ │
│  │   enterprise_            │       │ enterprise_device        │ │
│  │   biometricdevice        │       │ command                  │ │
│  │ ┌──────────────────────┐ │       │ ┌──────────────────────┐ │ │
│  │ │ id                   │ │       │ │ id                   │ │ │
│  │ │ serial_number ◄──────┼─┼──────┬┤ │ device_id (FK) ──────┤ │ │
│  │ │ name                 │ │       │ │ user_id              │ │ │
│  │ │ location             │ │       │ │ name                 │ │ │
│  │ │ device_ip            │ │       │ │ status [pending/done]│ │ │
│  │ │ device_port          │ │       │ │ created_at           │ │ │
│  │ │ device_model         │ │       │ │ updated_at           │ │ │
│  │ │ is_active            │ │       │ └──────────────────────┘ │ │
│  │ │ last_seen_at ◄───────┼─┼─────┬┤                           │ │
│  │ │ created_at           │ │     │ │  Indexes:               │ │
│  │ │ enterprise_id (FK)   │ │     │ │  - (device, status)     │ │
│  │ │ branch_id (FK)       │ │     │ │  - (status, -created) │ │
│  │ └──────────────────────┘ │     │ └──────────────────────────┘ │
│  └──────────────────────────┘     │                             │
│                                    │  1:N Relationship            │
│                                    │  One device has many         │
│                                    │  commands                    │
│                                    └──────────────────────────────┘
│
│  Status Transitions:
│  pending → (Device polls and executes) → done
│  pending → (Error occurs) → failed
│
│  Indexes optimize:
│  - Device polling: (device, status='pending')
│  - Recent commands: (status, -created_at)
│
└─────────────────────────────────────────────────────────────────┘
```

## ADMS Protocol Message Sequence

```
Time    Device                          Server              Database
│                                                              │
├─ 0s   ──GET /cdata?SN=AB123456───────────────────────────► │
│                                                              │
│       ◄─ GET OPTION FROM: AB123456 ──────────────────────  │
│                          [If device exists: update last_seen]
│                          [If not exists: create device]    │
│       
├─30s   ──GET /getrequest?SN=AB123456──────────────────────► │
│                                                              │
│       ◄─ OK ──────────────────────────────────────────────  │
│       [No pending commands for this device]                 │
│
├─60s   ──GET /getrequest?SN=AB123456──────────────────────► │
│       [User creates command from frontend]                  │
│       ┌─────────────────────────────────────────────────┐  │
│       │ POST /api/commands/                             │  │
│       │ { device_serial: AB123456, user_id: 1001, ... }│  │
│       │                                                 │  │
│       │ ✓ Command created in 'pending' status          │  │
│       └─────────────────────────────────────────────────┘  │
│                                                              │
│       ◄─ C:42:DATA UPDATE USERINFO PIN=1001\tName=...\t ── │
│       [Command #42 returned to device]                      │
│                                                              │
├─65s   [Device executes locally: Adds user to fingerprint]   │
│       ──POST /devicecmd?SN=AB123456──────────────────────► │
│       Body: C:42:success                                    │
│                                                              │
│       ◄─ OK ──────────────────────────────────────────────  │
│       [Command #42 marked as 'done']                        │
│
├─90s   ──GET /getrequest?SN=AB123456──────────────────────► │
│                                                              │
│       ◄─ OK ──────────────────────────────────────────────  │
│       [No more pending commands]                            │
│
```

## State Machine: Command Lifecycle

```
                    ┌─────────────┐
                    │   CREATED   │
                    │ (in request)│
                    └──────┬──────┘
                           │
                           │ Save to DB
                           ▼
                    ┌─────────────────┐
                    │    PENDING      │
                    │ (Waiting for    │
                    │  device to      │
                    │  poll)          │
                    └──────┬──────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
      Device polls    Polling       Polling
      and gets       fails        succeeds
      error (rare)   (rare)         ✓
              │            │            │
              ▼            ▼            ▼
           FAILED      PENDING      Device executes
        (Needs fix)   (stays)       command locally
                                       │
                                       │ Acknowledges
                                       ▼
                                    ┌────────┐
                                    │  DONE  │
                                    │ ✓ Done │
                                    └────────┘


Status flow in practice:
1. Frontend creates command → Status = 'pending'
2. Device polls and gets command
3. Device executes (adds user, etc.)
4. Device acknowledges completion
5. Server marks command → Status = 'done'
6. Frontend can see 'done' status
```

## Network Architecture (Deployment)

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└─────────────────────────────────────────────────────────────┘
         │
         │ HTTPS (Frontend)
         │ + ADMS TCP (Devices)
         │
┌────────▼────────────────────────────────────────────────────┐
│         Your Server (EC2, VPS, etc.)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Port 443/HTTPS    Port 8000/HTTP                            │
│  │                 │                                         │
│  ├─► [Nginx]       ├─► [Django Dev / Gunicorn]             │
│  │    (Reverse     │    - /api/* endpoints                 │
│  │     Proxy)      │    - /iclock/* endpoints              │
│  │                 │    - Static files                     │
│  │                 │                                        │
│  │                 └─► [PostgreSQL]                        │
│  │                     - BiometricDevice                   │
│  │                     - DeviceCommand                     │
│  │                     - Employee data                     │
│  │                                                          │
│  └─► Frontend (Next.js)                                     │
│      - React components                                    │
│      - API calls to /api/*                                 │
│
└───────────────────────────────────────────────────────────────┘
         │
         │ Direct TCP Connection to Port 8000
         │
┌────────▼────────────────────────────────────────────────────┐
│              Biometric Devices (Multiple Locations)          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Device A (Office)    Device B (Warehouse)  Device C (Site) │
│  - TCP/IP connected   - TCP/IP connected    - TCP/IP        │
│  - Polls every 30s    - Polls every 30s     - Polls every   │
│  - Can reach server   - Can reach server    - Can reach     │
│                                                  server      │
│
└───────────────────────────────────────────────────────────────┘
```

## Data Flow: Creating a User on Device

```
Step 1: Admin User in Frontend
    │
    ▼
[Form Input]
  ├─ Device: "AB123456"
  ├─ User ID: "1001"
  └─ Name: "John Doe"
    │
    ▼

Step 2: Frontend → API
    │
    POST /api/commands/
    Content-Type: application/json
    Authorization: Bearer <token>
    {
      "device_serial_number": "AB123456",
      "user_id": "1001",
      "name": "John Doe"
    }
    │
    ▼

Step 3: Django Validation & Storage
    │
    ├─ Validate device exists
    │  └─ BiometricDevice.objects.get(serial_number="AB123456") ✓
    │
    ├─ Validate user input
    │  ├─ user_id not empty ✓
    │  └─ name not empty ✓
    │
    └─ Create DeviceCommand
       └─ device=<Device obj>
       └─ user_id="1001"
       └─ name="John Doe"
       └─ status="pending"
       └─ created_at=<now>
    │
    ▼

Step 4: Response to Frontend
    │
    201 Created
    {
      "id": 42,
      "device": 1,
      "user_id": "1001",
      "name": "John Doe",
      "status": "pending",
      "created_at": "2025-05-05T10:30:00Z",
      "updated_at": "2025-05-05T10:30:00Z"
    }
    │
    ▼

Step 5: Device Polling (Next 30 seconds)
    │
    GET /iclock/getrequest?SN=AB123456
    │
    ▼
    
    Server checks:
    SELECT * FROM DeviceCommand
    WHERE device_id=1 AND status='pending'
    LIMIT 1
    │
    └─ Found command #42 ✓
    │
    ▼
    
    Response:
    C:42:DATA UPDATE USERINFO PIN=1001\tName=John Doe\tPri=0\tPasswd=\tCard=\t
    │
    ▼

Step 6: Device Processes
    │
    ├─ Parse command format
    ├─ Extract user ID: 1001
    ├─ Extract name: John Doe
    ├─ Add to local biometric database
    ├─ Assign enrollment space
    └─ Ready for fingerprint enrollment
    │
    ▼

Step 7: Device Acknowledges
    │
    POST /iclock/devicecmd?SN=AB123456
    Body: C:42:success
    │
    ▼

Step 8: Server Marks Complete
    │
    UPDATE DeviceCommand
    SET status='done', updated_at=<now>
    WHERE id=42
    │
    ▼

Step 9: Frontend Sees Completion
    │
    GET /api/devices/  (or query commands)
    └─ Shows command #42 with status='done'
    
    User successfully synced to device!
```

These diagrams provide visual understanding of how the system architecture works end-to-end.
