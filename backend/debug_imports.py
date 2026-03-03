"""Run: python debug_imports.py"""
import sys, os
sys.path.insert(0, '.')

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

print("Step 1: importing motor...", flush=True)
from motor.motor_asyncio import AsyncIOMotorClient
print("Step 2: motor OK. importing redis.asyncio...", flush=True)
import redis.asyncio as aioredis
print("Step 3: redis OK. creating Motor client...", flush=True)
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
print(f"  MONGO_URL set: {'YES' if os.environ.get('MONGO_URL') else 'NO'}", flush=True)
client = AsyncIOMotorClient(mongo_url, connect=False, serverSelectionTimeoutMS=5000)
print("Step 4: Motor client created OK.", flush=True)
db = client['lobbi_db']
print("Step 5: db OK. All database.py steps passed!", flush=True)
