from django.urls import include, path

from .views import (
    DepartmentCreateAPIView,
    DepartmentDetailAPIView,
    EnterpriseHierarchyAPIView,
    CreateEmployeeAPIView,
    ListEmployeesAPIView,
    EmployeeDetailAPIView,
    CreateEmployeeAndSyncAPIView,
    LinkUserToEmployeeAPIView,
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

    # Device APIs now live in `device.api_urls` and are included at the project
    # root as well as under `/attendance/` for compatibility.
    path('', include('device.api_urls')),

]
