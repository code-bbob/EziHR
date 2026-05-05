from django.urls import path

from .views import IClockCDataView, IClockGetRequestView, IClockDeviceCmdView

app_name = 'device_iclock'

urlpatterns = [
    path('iclock/cdata', IClockCDataView.as_view(), name='iclock_cdata'),
    path('iclock/cdata/', IClockCDataView.as_view(), name='iclock_cdata_slash'),
    path('iclock/getrequest', IClockGetRequestView.as_view(), name='iclock_getrequest'),
    path('iclock/getrequest/', IClockGetRequestView.as_view(), name='iclock_getrequest_slash'),
    path('iclock/devicecmd', IClockDeviceCmdView.as_view(), name='iclock_devicecmd'),
    path('iclock/devicecmd/', IClockDeviceCmdView.as_view(), name='iclock_devicecmd_slash'),
]
