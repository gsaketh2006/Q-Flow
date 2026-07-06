from app.db.base_class import Base

# Import all models to register them on Base.metadata for migrations
from app.models.role import Role
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.office import Office
from app.models.counter import Counter
from app.models.service import Service
from app.models.appointment import Appointment
from app.models.queue_entry import QueueEntry
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.models.holiday import Holiday
