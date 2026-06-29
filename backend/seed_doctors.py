"""
Seed script: creates one demo doctor per specialty for AyuMitraAI.
Run: uv run python seed_doctors.py
Password for ALL demo doctors: AyuMitra123
"""
import asyncio
import bcrypt
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "ayumitra_db")

# ── Specialty → demo doctor data ─────────────────────────────────────────────
DEMO_DOCTORS = [
    # (full_name, email, specialization, facility, experience, phone)
    ("Dr. Rajesh Sharma",      "rajesh.sharma@apollo.demo",       "Cardiology",                       "Apollo Hospitals",          15, "+91-9800001001"),
    ("Dr. Suresh Nair",        "suresh.nair@apollo.demo",          "Neurology",                        "Apollo Hospitals",          12, "+91-9800001002"),
    ("Dr. Priya Menon",        "priya.menon@healthfirst.demo",     "General Medicine",                 "HealthFirst Clinic",        10, "+91-9800001003"),
    ("Dr. Vikram Singh",       "vikram.singh@apollo.demo",         "Orthopedic Surgery",               "Apollo Hospitals",          14, "+91-9800001004"),
    ("Dr. Ramesh Gupta",       "ramesh.gupta@apollo.demo",         "Gastroenterology",                 "Apollo Hospitals",          11, "+91-9800001005"),
    ("Dr. Deepa Varma",        "deepa.varma@apollo.demo",          "Pulmonology",                      "Apollo Hospitals",          9,  "+91-9800001006"),
    ("Dr. Nisha Kapoor",       "nisha.kapoor@apollo.demo",         "Dermatology",                      "Apollo Hospitals",          8,  "+91-9800001007"),
    ("Dr. Lalitha Rao",        "lalitha.rao@apollo.demo",          "Ophthalmology",                    "Apollo Hospitals",          13, "+91-9800001008"),
    ("Dr. Kiran Bhat",         "kiran.bhat@apollo.demo",           "Emergency Medicine",               "Apollo Hospitals",          16, "+91-9800001009"),
    ("Dr. Ananya Krishnan",    "ananya.krishnan@medcare.demo",     "Gynecology",                       "MedCare Women's Clinic",    12, "+91-9800001010"),
    ("Dr. Meera Pillai",       "meera.pillai@medcare.demo",        "Obstetrics",                       "MedCare Women's Clinic",    10, "+91-9800001011"),
    ("Dr. Arjun Reddy",        "arjun.reddy@apollo.demo",          "Pediatrics",                       "Apollo Hospitals",          11, "+91-9800001012"),
    ("Dr. Kavitha Iyer",       "kavitha.iyer@apollo.demo",         "Internal Medicine",                "Apollo Hospitals",          9,  "+91-9800001013"),
    ("Dr. Sanjay Patel",       "sanjay.patel@heartcare.demo",      "Cardiology",                       "HeartCare Clinic",          17, "+91-9800001014"),
    ("Dr. Rohini Desai",       "rohini.desai@skincare.demo",       "Dermatology",                      "SkinCare Clinic",           7,  "+91-9800001015"),
    ("Dr. Vinod Kumar",        "vinod.kumar@apollo.demo",          "Neurosurgery",                     "Apollo Hospitals",          18, "+91-9800001016"),
    ("Dr. Pooja Nambiar",      "pooja.nambiar@medcare.demo",       "Psychiatry",                       "MindCare Clinic",           8,  "+91-9800001017"),
    ("Dr. Harish Shetty",      "harish.shetty@apollo.demo",        "Urology",                          "Apollo Hospitals",          12, "+91-9800001018"),
    ("Dr. Smitha George",      "smitha.george@cancercare.demo",    "Oncology",                         "CancerCare Institute",      14, "+91-9800001019"),
    ("Dr. Ravi Teja",          "ravi.teja@apollo.demo",            "Endocrinology",                    "Apollo Hospitals",          10, "+91-9800001020"),
    ("Dr. Supriya Bose",       "supriya.bose@apollo.demo",         "Rheumatology",                     "Apollo Hospitals",          9,  "+91-9800001021"),
    ("Dr. Aditya Menon",       "aditya.menon@apollo.demo",         "Nephrology",                       "Apollo Hospitals",          11, "+91-9800001022"),
    ("Dr. Lakshmi Rajan",      "lakshmi.rajan@apollo.demo",        "Hematology",                       "Apollo Hospitals",          10, "+91-9800001023"),
    ("Dr. Mohan Pillai",       "mohan.pillai@apollo.demo",         "Infectious Disease",               "Apollo Hospitals",          13, "+91-9800001024"),
    ("Dr. Girish Nair",        "girish.nair@apollo.demo",          "Radiology",                        "Apollo Hospitals",          15, "+91-9800001025"),
    ("Dr. Tejaswi Rao",        "tejaswi.rao@apollo.demo",          "Pathology",                        "Apollo Hospitals",          8,  "+91-9800001026"),
    ("Dr. Prasad Kulkarni",    "prasad.kulkarni@apollo.demo",      "Anesthesiology",                   "Apollo Hospitals",          14, "+91-9800001027"),
    ("Dr. Shruti Joshi",       "shruti.joshi@orthocare.demo",      "Physical Medicine and Rehabilitation", "OrthoRehab Centre",    7,  "+91-9800001028"),
    ("Dr. Nikhil Verma",       "nikhil.verma@surgery.demo",        "General Surgery",                  "City Surgical Hospital",    16, "+91-9800001029"),
    ("Dr. Reshma Thomas",      "reshma.thomas@surgery.demo",       "Plastic Surgery",                  "City Surgical Hospital",    9,  "+91-9800001030"),
    ("Dr. Sunil Mehta",        "sunil.mehta@surgery.demo",         "Thoracic Surgery",                 "City Surgical Hospital",    17, "+91-9800001031"),
    ("Dr. Kavya Sharma",       "kavya.sharma@surgery.demo",        "Vascular Surgery",                 "City Surgical Hospital",    12, "+91-9800001032"),
    ("Dr. Balaji Venkat",      "balaji.venkat@apollo.demo",        "Otolaryngology (ENT)",             "Apollo Hospitals",          10, "+91-9800001033"),
    ("Dr. Prathima Reddy",     "prathima.reddy@apollo.demo",       "Allergy and Immunology",           "Apollo Hospitals",          8,  "+91-9800001034"),
    ("Dr. Krishnadev Nair",    "krishnadev.nair@apollo.demo",      "Geriatrics",                       "Apollo Hospitals",          13, "+91-9800001035"),
    ("Dr. Anupama Chandra",    "anupama.chandra@apollo.demo",      "Medical Genetics",                 "Apollo Hospitals",          11, "+91-9800001036"),
    ("Dr. Sriram Kulkarni",    "sriram.kulkarni@medcare.demo",     "Family Medicine",                  "MedCare Clinic",            10, "+91-9800001037"),
]

PASSWORD = "AyuMitra123"

async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    hashed_pw = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
    now = datetime.now(timezone.utc).isoformat()

    created = 0
    skipped = 0

    for (full_name, email, specialization, facility, exp, phone) in DEMO_DOCTORS:
        existing = await db.users.find_one({"email": email})
        if existing:
            # Ensure doctor record is online
            await db.doctors.update_one(
                {"user_id": existing["user_id"]},
                {"$set": {"availability.is_online": True}}
            )
            skipped += 1
            continue

        user_id = str(uuid.uuid4())
        doctor_id = str(uuid.uuid4())

        # Create user account
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "password": hashed_pw,
            "role": "doctor",
            "full_name": full_name,
            "created_at": now,
        })

        # Create doctor profile
        await db.doctors.insert_one({
            "doctor_id": doctor_id,
            "user_id": user_id,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "specialization": specialization,
            "experience_years": exp,
            "facility_name": facility,
            "facility_type": "hospital" if "Hospital" in facility or "Institute" in facility else "clinic",
            "facility_id": None,
            "availability": {
                "is_online": True,
                "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "hours": "9:00 AM - 6:00 PM",
            },
            "rating": round(4.2 + (exp % 10) * 0.07, 1),
            "consultation_fee": 500,
            "created_at": now,
        })

        print(f"  Created: {full_name} ({specialization})")
        created += 1

    print(f"\nDone. Created: {created} | Skipped (already exist): {skipped}")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
