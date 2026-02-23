"""
One-time script to generate a bcrypt password hash for .env.
Usage: python scripts/create_password.py
"""

import getpass
import sys
import os

# Add parent dir to path so we can import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    print("MarketDASH PRO — Password Setup")
    print("=" * 40)
    password = getpass.getpass("Enter password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Passwords do not match!")
        sys.exit(1)

    if len(password) < 8:
        print("Password must be at least 8 characters.")
        sys.exit(1)

    hashed = pwd_context.hash(password)
    print(f"\nAdd this to your backend/.env file:")
    print(f"APP_PASSWORD_HASH={hashed}")


if __name__ == "__main__":
    main()
