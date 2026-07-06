from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    """
    SQLAlchemy Declarative Base class for QFlow.
    Defined in isolation to prevent circular imports.
    """
    pass
