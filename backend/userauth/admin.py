from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as UserAdmin
from .models import User, Otp, UserProfile

class UserModelAdmin(UserAdmin):
    # The fields to be used in displaying the User model.
    # These override the definitions on the base UserAdmin
    # that reference specific fields on auth.User.
    list_display = ["email", "name", "is_superuser", "is_staff"]
    list_filter = ["is_superuser"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Personal info", {"fields": ["name", "id"]}),
        ("Permissions", {"fields": ["is_superuser", "is_staff","groups","user_permissions"]}),
    ]
    # add_fieldsets is not a standard ModelAdmin attribute. UserAdmin
    # overrides get_fieldsets to use this attribut  e when creating a user.
    add_fieldsets = [
        (
            None,
            {
                "classes": ["wide"],
                "fields": ["email", "name", "password1", "password2"],
            }
        ),
    ]
    search_fields = ["email"]
    ordering = ["email"]
    filter_horizontal = ["groups"]

# Now register the new UserAdmin...
admin.site.register(User, UserModelAdmin)
admin.site.register(Otp)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
	list_display = ('user', 'enterprise', 'branch', 'created_at')
	search_fields = ('user__username', 'user__email', 'enterprise__name', 'branch__name')
