from django.urls import path

from .views import (
    BiometricDeviceListAPIView,
    BiometricEnrollmentAPIView,
    CreateDeviceCommandAPIView,
    EmployeeDeviceSyncAPIView,
    ListDevicesAPIView,
)

app_name = 'device_api'

urlpatterns = [
    path('api/biometric/enroll/', BiometricEnrollmentAPIView.as_view(), name='biometric_enroll'),
    path('api/biometric/devices/', BiometricDeviceListAPIView.as_view(), name='biometric_devices'),
    path('api/employees/sync-device/', EmployeeDeviceSyncAPIView.as_view(), name='employee_sync_device'),
    path('api/commands/', CreateDeviceCommandAPIView.as_view(), name='create_device_command'),
    path('api/devices/', ListDevicesAPIView.as_view(), name='list_devices'),
]
