from db import create_database, default_db_path
from seed import seed

conn = create_database(default_db_path())
seed(conn, reset=True)
conn.close()
print("Database re-seeded.")
