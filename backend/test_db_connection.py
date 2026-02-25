import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load env from .env file
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

async def test_mongo():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'lobbi_db')
    
    print(f"Connecting to {mongo_url}...")
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        # Force connection verification
        await client.server_info()
        print("Successfully connected to MongoDB!")
        
        db = client[db_name]
        collections = await db.list_collection_names()
        print(f"Database '{db_name}' contains collections: {collections}")
        
        user_count = await db.users.count_documents({})
        print(f"Number of users in 'users' collection: {user_count}")
        
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_mongo())
