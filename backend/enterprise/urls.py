from django.urls import path

from .views import (
    DepartmentCreateAPIView,
    DepartmentDetailAPIView,
    EnterpriseHierarchyAPIView,
    CreateEmployeeAPIView,
    ListEmployeesAPIView,
    EmployeeDetailAPIView,
    BiometricEnrollmentAPIView,
    BiometricDeviceListAPIView,
    EmployeeDeviceSyncAPIView,
    CreateEmployeeAndSyncAPIView,
    LinkUserToEmployeeAPIView,
    CreateDeviceCommandAPIView,
    ListDevicesAPIView,
    adms_cdata,
    adms_getrequest,
    adms_devicecmd,
)

app_name = 'enterprise'

urlpatterns = [
    path('api/hierarchy/', EnterpriseHierarchyAPIView.as_view(), name='hierarchy'),
    path('api/departments/', DepartmentCreateAPIView.as_view(), name='create_department'),
    path('api/departments/<int:department_id>/', DepartmentDetailAPIView.as_view(), name='department_detail'),

    # Employee management (moved from attendance)
    path('api/employees/create/', CreateEmployeeAPIView.as_view(), name='create_employee'),
    path('api/employees/create-and-sync/', CreateEmployeeAndSyncAPIView.as_view(), name='create_employee_and_sync'),
    path('api/employees/', ListEmployeesAPIView.as_view(), name='list_employees'),
    path('api/employees/<int:employee_id>/', EmployeeDetailAPIView.as_view(), name='employee_detail'),
    path('api/employees/link-user/', LinkUserToEmployeeAPIView.as_view(), name='link_user'),

    # Biometric device enrollment
    path('api/biometric/enroll/', BiometricEnrollmentAPIView.as_view(), name='biometric_enroll'),
    path('api/biometric/devices/', BiometricDeviceListAPIView.as_view(), name='biometric_devices'),
    path('api/employees/sync-device/', EmployeeDeviceSyncAPIView.as_view(), name='employee_sync_device'),

    # Device command management (DRF endpoints)
    path('api/commands/', CreateDeviceCommandAPIView.as_view(), name='create_device_command'),
    path('api/devices/', ListDevicesAPIView.as_view(), name='list_devices'),

    # ZKTeco ADMS Protocol endpoints (Device-to-Server)
    path('iclock/cdata', adms_cdata, name='adms_cdata'),
    path('iclock/getrequest', adms_getrequest, name='adms_getrequest'),
    path('iclock/devicecmd', adms_devicecmd, name='adms_devicecmd'),

]
