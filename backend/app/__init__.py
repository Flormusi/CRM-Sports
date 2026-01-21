from .database import Base, engine
from . import models

# Create database tables
Base.metadata.create_all(bind=engine)