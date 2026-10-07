import os

# Use an in-memory database for tests so they never touch the real data file.
os.environ.setdefault("GA_DATABASE_URL", "sqlite://")
