from django.urls import path
from django.urls import include

from .views import (
    DashboardAPIView,
    AttendanceRowsAPIView,
    DashboardStatsAPIView,
    HierarchicalDashboardAPIView,
    BranchDashboardAPIView,
    DepartmentDashboardAPIView,
    IClockCDataView,
    IClockGetRequestView,
    sse_events_view,
    LateArrivalsAPIView,
    EarlyDeparturesAPIView,
)
from .auth_views import LoginAPIView, LogoutAPIView, CurrentUserAPIView
from .user_management_views import (
    CreateUserAPIView,
)

app_name = 'attendance'

urlpatterns = [
    # Auth endpoints
    path('api/auth/login/', LoginAPIView.as_view(), name='login'),
    path('api/auth/logout/', LogoutAPIView.as_view(), name='logout'),
    path('api/auth/user/', CurrentUserAPIView.as_view(), name='current_user'),
    
    # User management endpoints
    path('api/users/create/', CreateUserAPIView.as_view(), name='create_user'),
    
    # Dashboard endpoints
    path('api/daily/', DashboardAPIView.as_view(), name='dashboard'),
    path('api/dashboard/stats/', DashboardStatsAPIView.as_view(), name='dashboard_stats'),
    path('api/attendance/rows/', AttendanceRowsAPIView.as_view(), name='attendance_rows'),
    path('api/dashboard/hierarchical/', HierarchicalDashboardAPIView.as_view(), name='hierarchical_dashboard'),
    path('api/dashboard/branch/<int:branch_id>/', BranchDashboardAPIView.as_view(), name='branch_dashboard'),
    path('api/dashboard/department/<int:department_id>/', DepartmentDashboardAPIView.as_view(), name='department_dashboard'),
    
    # Late arrivals and early departures
    path('api/dashboard/late-arrivals/', LateArrivalsAPIView.as_view(), name='late_arrivals'),
    path('api/dashboard/early-departures/', EarlyDeparturesAPIView.as_view(), name='early_departures'),
        # Monthly reports
        path('api/reports/monthly-summary/',
            __import__('attendance.views', fromlist=['MonthlySummaryAPIView']).MonthlySummaryAPIView.as_view(),
            name='monthly_summary'),
        path('api/reports/monthly-summary-detailed/',
            __import__('attendance.views', fromlist=['MonthlySummaryDetailedAPIView']).MonthlySummaryDetailedAPIView.as_view(),
            name='monthly_summary_detailed'),
    
    path('api/events/stream/', sse_events_view, name='events_stream'),
    path('', include('device.iclock_urls')),
]
