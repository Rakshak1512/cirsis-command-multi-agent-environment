"""
CRISIS COMMAND — Standalone Production Database Seeder
CLI script to seed test accounts (Citizen, Fire Team, Hospital, Admin) into production Firestore.

Usage:
    python scripts/seed_production.py
    python scripts/seed_production.py --force
"""

import sys
import os
import argparse
import json

# Ensure backend root is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

def main():
    parser = argparse.ArgumentParser(description="Seed Crisis Command test accounts into Firestore.")
    parser.add_argument("--force", action="store_true", help="Force update existing test accounts and reset passwords.")
    args = parser.parse_args()

    print("============================================================")
    print(" CRISIS COMMAND - PRODUCTION DATABASE SEEDING UTILITY")
    print("============================================================")
    print(f"[*] Environment: {os.getenv('ENV', 'production')}")
    print(f"[*] Force overwrite existing accounts: {args.force}")

    from app.services.firebase_service import initialize_firebase, is_firestore_available
    app = initialize_firebase()
    if app:
        print(f"[*] Firebase Admin SDK: Connected (Project: {os.getenv('FIREBASE_PROJECT_ID')})")
    else:
        print("[!] Warning: Firebase Admin SDK not connected. Seeding will run in local RAM mode only.")

    firestore_active = is_firestore_available()
    print(f"[*] Cloud Firestore active: {firestore_active}")
    print("------------------------------------------------------------")

    from app.services.seed_service import seed_test_accounts
    summary = seed_test_accounts(force_update=args.force)

    print("\n[RESULTS SUMMARY]")
    print(f"  Firestore Connected : {summary['firestore_connected']}")
    print(f"  Total Personas      : {summary['total_accounts']}")
    print(f"  Created / Updated   : {summary['created_or_updated']}")
    print(f"  Skipped (Existing)  : {summary['skipped']}")
    print(f"  Failed              : {summary['failed']}")
    print("------------------------------------------------------------")

    for res in summary["results"]:
        status_tag = f"[{res['status']}]"
        print(f"  {status_tag:10} {res['email']} ({res['role']}) -> {res['detail']}")

    print("============================================================")
    if summary["failed"] > 0:
        sys.exit(1)
    print("[SUCCESS] Database seeding completed successfully.\n")

if __name__ == "__main__":
    main()
