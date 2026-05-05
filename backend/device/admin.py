from django.contrib import admin

from .models import BiometricDevice, DeviceCommand, EmployeeBiometricMapping


@admin.register(BiometricDevice)
class BiometricDeviceAdmin(admin.ModelAdmin):
    list_display = ('serial_number', 'name', 'enterprise', 'branch', 'is_active', 'last_seen_at', 'created_at')
    list_filter = ('is_active', 'enterprise', 'branch')
    search_fields = ('serial_number', 'name', 'device_model')
    fields = ('name', 'serial_number', 'device_ip', 'device_port', 'device_model', 'enterprise', 'branch', 'is_active', 'last_seen_at')


@admin.register(EmployeeBiometricMapping)
class EmployeeBiometricMappingAdmin(admin.ModelAdmin):
    list_display = ('employee', 'device', 'device_user_id', 'created_at')
    search_fields = ('employee__name', 'employee__employee_code', 'device__serial_number', 'device_user_id')
    list_filter = ('device__enterprise', 'device__branch')
    fields = ('employee', 'device', 'device_user_id')


@admin.register(DeviceCommand)
class DeviceCommandAdmin(admin.ModelAdmin):
    list_display = ('device', 'user_id', 'name', 'status', 'created_at')
    search_fields = ('device__serial_number', 'user_id', 'name')
    list_filter = ('status', 'device__enterprise', 'device__branch', 'created_at')
    fields = ('device', 'user_id', 'name', 'status')
    readonly_fields = ('created_at', 'updated_at')
