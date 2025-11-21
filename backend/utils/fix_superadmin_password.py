"""
Script to fix superadmin password hash
Generates correct bcrypt hash for 'Admin123!' and updates the database
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.auth import hash_password, verify_password
from config.database import supabase

def fix_superadmin_password():
    """Generate correct password hash for superadmin and update database"""
    
    password = "Admin123!"
    username = "superadmin"
    
    print("=" * 60)
    print("FIX SUPERADMIN PASSWORD")
    print("=" * 60)
    print(f"\nUsername: {username}")
    print(f"Password: {password}")
    
    # Generate new hash
    print("\n[1/3] Generating password hash...")
    new_hash = hash_password(password)
    print(f"[OK] Hash generated: {new_hash[:50]}...")
    
    # Verify the hash works
    print("\n[2/3] Verifying hash...")
    if verify_password(password, new_hash):
        print("[OK] Hash verification successful!")
    else:
        print("[ERROR] Hash verification failed!")
        return
    
    # Check if user exists
    print("\n[3/3] Checking user in database...")
    try:
        response = supabase.table("users").select("*").eq("username", username).execute()
        
        if not response.data or len(response.data) == 0:
            print(f"[ERROR] User '{username}' not found in database!")
            print("\n[TIP] You need to run the SQL schema first:")
            print("   Run docs/user_schema.sql in Supabase SQL Editor")
            return
        
        user = response.data[0]
        print(f"[OK] User found: {user.get('full_name')} (ID: {user['id']})")
        
        # Update password hash
        print("\n[4/4] Updating password hash in database...")
        supabase.table("users").update({
            "password_hash": new_hash
        }).eq("id", user["id"]).execute()
        
        print("[OK] Password hash updated successfully!")
        print("\n" + "=" * 60)
        print("You can now login with:")
        print(f"  Username: {username}")
        print(f"  Password: {password}")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    fix_superadmin_password()

