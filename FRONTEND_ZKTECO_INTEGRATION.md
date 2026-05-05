# ZKTeco Device Sync - Frontend Integration Guide

This guide shows how to integrate ZKTeco device sync into your Next.js frontend.

## API Client Setup

Add to your `lib/api-client.ts`:

```typescript
interface DeviceCommand {
  id: number;
  device: number;
  user_id: string;
  name: string;
  status: 'pending' | 'done' | 'failed';
  created_at: string;
  updated_at: string;
}

interface BiometricDevice {
  id: number;
  name: string;
  serial_number: string;
  location: string;
  device_ip: string;
  device_port: number;
  device_model: string;
  enterprise: number;
  branch: number;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

// Create device command
export async function createDeviceCommand(
  serialNumber: string,
  userId: string,
  name: string
): Promise<DeviceCommand> {
  const response = await apiClient.post('/api/commands/', {
    device_serial_number: serialNumber,
    user_id: userId,
    name: name,
  });
  return response.data;
}

// List all devices
export async function listDevices(): Promise<BiometricDevice[]> {
  const response = await apiClient.get('/api/devices/');
  return response.data;
}

// Check if device is online
export function isDeviceOnline(device: BiometricDevice): boolean {
  if (!device.last_seen_at) return false;
  const lastSeen = new Date(device.last_seen_at);
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  return lastSeen > fiveMinutesAgo;
}
```

## UI Components

### Device List Component

```typescript
// components/DeviceList.tsx
'use client';

import { useEffect, useState } from 'react';
import { listDevices, isDeviceOnline, BiometricDevice } from '@/lib/api-client';

export function DeviceList() {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
    // Refresh every 30 seconds
    const interval = setInterval(loadDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadDevices() {
    try {
      setLoading(true);
      const data = await listDevices();
      setDevices(data);
      setError(null);
    } catch (err) {
      setError('Failed to load devices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading devices...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Biometric Devices</h2>
      {devices.length === 0 ? (
        <p>No devices registered</p>
      ) : (
        <div className="grid gap-4">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} onRefresh={loadDevices} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceCard({ device, onRefresh }: { device: BiometricDevice; onRefresh: () => void }) {
  const online = isDeviceOnline(device);
  const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never';

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg">{device.name || device.serial_number}</h3>
          <p className="text-gray-600 text-sm">{device.serial_number}</p>
          <p className="text-gray-600 text-sm">Location: {device.location || 'N/A'}</p>
          <p className="text-gray-600 text-sm">Model: {device.device_model || 'Unknown'}</p>
        </div>
        <div className="text-right">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
            online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {online ? '🟢 Online' : '🔴 Offline'}
          </div>
          <p className="text-gray-600 text-xs mt-2">Last seen: {lastSeen}</p>
        </div>
      </div>
      <SyncUserForm serialNumber={device.serial_number} onSuccess={onRefresh} />
    </div>
  );
}

function SyncUserForm({ serialNumber, onSuccess }: { serialNumber: string; onSuccess: () => void }) {
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim() || !userName.trim()) return;

    try {
      setLoading(true);
      await createDeviceCommand(serialNumber, userId, userName);
      setMessage({ type: 'success', text: 'Command created! Device will sync on next poll.' });
      setUserId('');
      setUserName('');
      onSuccess();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create command' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t pt-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="User ID (PIN)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={loading}
          className="px-3 py-2 border rounded text-sm"
        />
        <input
          type="text"
          placeholder="User Name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          disabled={loading}
          className="px-3 py-2 border rounded text-sm"
        />
        <button
          type="submit"
          disabled={loading || !userId.trim() || !userName.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Syncing...' : 'Sync User'}
        </button>
      </div>
      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
```

### Integration into Dashboard

Add to your dashboard page:

```typescript
// app/dashboard/page.tsx
import { DeviceList } from '@/components/DeviceList';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* ... other dashboard content ... */}
      
      <div className="border-t pt-6">
        <DeviceList />
      </div>
    </div>
  );
}
```

## State Management (if using Context)

```typescript
// hooks/useDeviceSync.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  createDeviceCommand, 
  listDevices,
  isDeviceOnline,
  BiometricDevice,
  DeviceCommand 
} from '@/lib/api-client';

export function useDeviceSync() {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listDevices();
      setDevices(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  const syncUser = useCallback(
    async (serialNumber: string, userId: string, name: string) => {
      try {
        const command = await createDeviceCommand(serialNumber, userId, name);
        await loadDevices(); // Refresh device list
        return command;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Sync failed');
      }
    },
    [loadDevices]
  );

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 30000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  return {
    devices,
    loading,
    error,
    syncUser,
    refreshDevices: loadDevices,
    isDeviceOnline,
  };
}
```

## Error Handling

The API client automatically handles:
- **401 Unauthorized:** Redirect to login
- **400 Bad Request:** Display validation errors
- **500 Server Error:** Show error message

Common errors to handle:

```typescript
async function syncUserSafely(
  serialNumber: string,
  userId: string,
  name: string
) {
  try {
    const command = await createDeviceCommand(serialNumber, userId, name);
    return { success: true, command };
  } catch (error: any) {
    if (error.response?.status === 400) {
      // Validation error - device not found or invalid input
      return { 
        success: false, 
        error: error.response.data.detail || 'Invalid input'
      };
    }
    return { 
      success: false, 
      error: 'Failed to create command. Please try again.'
    };
  }
}
```

## Real-time Updates

For real-time device status:

```typescript
// hooks/useDevicePolling.ts
export function useDevicePolling(intervalMs: number = 30000) {
  const { devices, refreshDevices } = useDeviceSync();

  useEffect(() => {
    // Initial load
    refreshDevices();

    // Poll for updates
    const interval = setInterval(refreshDevices, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, refreshDevices]);

  return devices;
}
```

## Testing

Test the integration:

```typescript
// Test device list loads
async function testDeviceList() {
  const devices = await listDevices();
  console.log('Devices:', devices);
  console.assert(Array.isArray(devices), 'Should return array');
}

// Test device command creation
async function testCreateCommand() {
  const command = await createDeviceCommand('AB123456', '1001', 'John Doe');
  console.log('Command:', command);
  console.assert(command.status === 'pending', 'Command should be pending');
}

// Test online status
function testOnlineStatus() {
  const device = {
    last_seen_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
  };
  console.assert(isDeviceOnline(device), 'Should be online');
}
```

## Styling Options

### Tailwind CSS (Already in your project)

The components use Tailwind classes - they should work out of the box.

### Custom Status Indicator

```typescript
function DeviceStatusBadge({ device }: { device: BiometricDevice }) {
  const online = isDeviceOnline(device);
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
      online ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
    }`}>
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
      <span className="text-sm font-medium">{online ? 'Online' : 'Offline'}</span>
    </div>
  );
}
```

## Production Considerations

1. **Polling Interval:** Currently 30 seconds, adjust based on your needs
2. **Error Retries:** Add retry logic for failed requests
3. **Caching:** Implement cache invalidation strategy
4. **Pagination:** Add pagination if devices list grows large
5. **Search/Filter:** Add device search/filter capabilities
6. **Batch Operations:** Support syncing multiple users at once
7. **Command History:** Show history of synced users
8. **Status Monitoring:** Track command execution status

Example with retry:

```typescript
async function createDeviceCommandWithRetry(
  serialNumber: string,
  userId: string,
  name: string,
  maxRetries: number = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createDeviceCommand(serialNumber, userId, name);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```
