import getpass
import sqlite3
import time

from backend.auth import get_connection, hash_password, normalize_email


def main():
    print("Create a FactRoot administrator account")
    name = input("Admin name: ").strip()
    email = normalize_email(input("Admin email: "))
    password = getpass.getpass("Admin password (8+ characters): ")
    confirmation = getpass.getpass("Confirm password: ")

    if len(name) < 2 or len(name) > 80:
        print("ERROR: Name must be between 2 and 80 characters.")
        return
    if "@" not in email or "." not in email.split("@")[-1]:
        print("ERROR: Email address is not valid.")
        return
    if len(password) < 8:
        print("ERROR: Password must contain at least 8 characters.")
        return
    if password != confirmation:
        print("ERROR: Passwords do not match.")
        return

    try:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO users (name, email, password_hash, role, created_at)
                VALUES (?, ?, ?, 'admin', ?)
                """,
                (name, email, hash_password(password), int(time.time())),
            )
    except sqlite3.IntegrityError:
        print("ERROR: An account already exists with this email.")
        return

    print("SUCCESS: Administrator account created.")


if __name__ == "__main__":
    main()
