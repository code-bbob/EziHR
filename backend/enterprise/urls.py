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
    LinkUserToEmployeeAPIView,
)

app_name = 'enterprise'

urlpatterns = [
    path('api/hierarchy/', EnterpriseHierarchyAPIView.as_view(), name='hierarchy'),
    path('api/departments/', DepartmentCreateAPIView.as_view(), name='create_department'),
    path('api/departments/<int:department_id>/', DepartmentDetailAPIView.as_view(), name='department_detail'),

    # Employee management (moved from attendance)
    path('api/employees/create/', CreateEmployeeAPIView.as_view(), name='create_employee'),
    path('api/employees/', ListEmployeesAPIView.as_view(), name='list_employees'),
    path('api/employees/<int:employee_id>/', EmployeeDetailAPIView.as_view(), name='employee_detail'),
    path('api/employees/link-user/', LinkUserToEmployeeAPIView.as_view(), name='link_user'),

    # Biometric device enrollment
    path('api/biometric/enroll/', BiometricEnrollmentAPIView.as_view(), name='biometric_enroll'),
    path('api/biometric/devices/', BiometricDeviceListAPIView.as_view(), name='biometric_devices'),
    path('api/employees/sync-device/', EmployeeDeviceSyncAPIView.as_view(), name='employee_sync_device'),

]