from db import connect
from seed import seed

conn = connect()
seed(conn, reset=True)
conn.close()
print("Database re-seeded.")
