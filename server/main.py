from db import connect
from app import create_app

db = connect()
app = create_app(db)
