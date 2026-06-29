import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
load_dotenv()

async def fix():
    client = AsyncIOMotorClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.getenv("DB_NAME", "ayumitra_db")]
    cursor = db.users.find({"password_hash": {"$exists": True}})
    count = 0
    async for user in cursor:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password": user["password_hash"]}, "$unset": {"password_hash": ""}}
        )
        count += 1
    print(f"Fixed {count} user documents (password_hash -> password)")
    client.close()

asyncio.run(fix())
