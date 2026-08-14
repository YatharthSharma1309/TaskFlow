from db import create_database, default_db_path
from app import create_app

db = create_database(default_db_path())
app = create_app(db)
