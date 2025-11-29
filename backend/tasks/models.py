from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class Task(models.Model):
    title = models.CharField(max_length=200)
    due_date = models.DateField()
    estimated_hours = models.FloatField(
        validators = [MinValueValidator(0.1)]
    )
    importance = models.IntegerField(
        validators = [MinValueValidator(1), MaxValueValidator(10)],
        help_text = "1 to 10 (10 being most important)"
    )
    dependencies = models.ManyToManyField(
        'self',
        symmetrical=False, # If task A depends on B, B doesn't automatically depend on A
        blank=True,
        related_name='blocking_tasks'
    )
    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.title} (Due: {self.due_date})"
