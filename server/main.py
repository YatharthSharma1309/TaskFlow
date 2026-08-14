from db import connect
from app import create_app

# Reconnect on boot so Neon idle drops do not leave a dead connection.
db = connect()
app = create_app(db)
