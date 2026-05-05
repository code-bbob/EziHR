"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

from enterprise.views import adms_cdata, adms_getrequest, adms_devicecmd

urlpatterns = [
    # Keep app-scoped API routes under /attendance/
    path('attendance/', include('attendance.urls')),
    path('userauth/api/', include('userauth.urls')),
    path('enterprise/', include('enterprise.urls')),

    # Legacy device endpoints. Many iClock devices call these root paths
    # (without the app prefix). We expose both no-slash variants so devices
    # that don't follow redirects can still reach the views.
    # These point to the actual ADMS protocol handlers that manage device commands
    path('iclock/getrequest', adms_getrequest, name='adms_getrequest_root'),
    path('iclock/getrequest/', adms_getrequest, name='adms_getrequest_root_slash'),
    path('iclock/cdata', adms_cdata, name='adms_cdata_root'),
    path('iclock/cdata/', adms_cdata, name='adms_cdata_root_slash'),
    path('iclock/devicecmd', adms_devicecmd, name='adms_devicecmd_root'),
    path('iclock/devicecmd/', adms_devicecmd, name='adms_devicecmd_root_slash'),

    path('admin/', admin.site.urls),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
