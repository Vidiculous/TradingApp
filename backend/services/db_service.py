import os
from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy.orm import sessionmaker

# Default to local SQLite for development
# For production (Vercel/Postgres), set DATABASE_URL in environment
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "database.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# connect_args={"check_same_thread": False} is required for SQLite
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

def init_db():
    from db_models.db import Account, Alert, AnalysisResult, Position, WatchlistItem
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
