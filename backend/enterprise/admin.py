from django.contrib import admin
from django.core.exceptions import PermissionDenied

from .models import Branch, Department, Employee, Enterprise, BiometricDevice, EmployeeBiometricMapping, DeviceCommand


@admin.register(Enterprise)
class EnterpriseAdmin(admin.ModelAdmin):
	list_display = ('name', 'licensed', 'licensed_until', 'created_at')
	search_fields = ('name', 'contact_email', 'contact_phone')

	def has_add_permission(self, request):
		return request.user.is_superuser

	def has_change_permission(self, request, obj=None):
		return request.user.is_superuser

	def has_delete_permission(self, request, obj=None):
		return request.user.is_superuser


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
	list_display = ('name', 'enterprise', 'contact_email', 'contact_phone', 'created_at')
	search_fields = ('name', 'enterprise__name')

	def has_add_permission(self, request):
		return request.user.is_superuser

	def has_change_permission(self, request, obj=None):
		return request.user.is_superuser

	def has_delete_permission(self, request, obj=None):
		return request.user.is_superuser


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
	list_display = ('name', 'enterprise', 'branch', 'created_at')
	search_fields = ('name', 'enterprise__name', 'branch__name')

	def get_queryset(self, request):
		qs = super().get_queryset(request)
		if request.user.is_superuser:
			return qs
		return qs.filter(enterprise__admin_user=request.user)

	def has_add_permission(self, request):
		return request.user.is_superuser or Enterprise.objects.filter(admin_user=request.user).exists()

	def has_change_permission(self, request, obj=None):
		return request.user.is_superuser or (obj is not None and obj.enterprise.admin_user_id == request.user.id)

	def has_delete_permission(self, request, obj=None):
		return request.user.is_superuser or (obj is not None and obj.enterprise.admin_user_id == request.user.id)

	def save_model(self, request, obj, form, change):
		if not request.user.is_superuser and obj.enterprise.admin_user_id != request.user.id:
			raise PermissionDenied('You can only manage departments for your enterprise.')
		super().save_model(request, obj, form, change)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
	list_display = ('name', 'employee_code', 'is_active', 'user', 'enterprise', 'branch', 'department', 'created_at')
	list_filter = ('is_active', 'role')
	search_fields = ('name', 'employee_code', 'user__username')
	fields = ('employee_code', 'name', 'avatar', 'user', 'is_active', 'enterprise', 'branch', 'department', 'role')


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