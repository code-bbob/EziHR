from rest_framework.permissions import BasePermission

class IsAdminRole(BasePermission):
    message = "Only Admins can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return (
            user and 
            user.is_authenticated and 
            hasattr(user, "employee") and 
            user.employee.role == "admin"
        )
