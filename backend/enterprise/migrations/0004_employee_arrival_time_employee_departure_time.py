from datetime import time

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('enterprise', '0003_employee_address_employee_dob_employee_email_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='arrival_time',
            field=models.TimeField(default=time(9, 0)),
        ),
        migrations.AddField(
            model_name='employee',
            name='departure_time',
            field=models.TimeField(default=time(18, 0)),
        ),
    ]
