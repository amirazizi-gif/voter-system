"""
Script to fix password hashes for ALL users in the system
Based on USER_CREDENTIALS.pdf
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.auth import hash_password, verify_password
from config.database import supabase

def fix_all_user_passwords():
    """Generate correct password hashes for all 40 users and update database"""
    
    # Define all users with their passwords from USER_CREDENTIALS.pdf
    users_to_fix = [
        # Super Admin
        {"username": "superadmin", "password": "Admin123!"},
        
        # PANTAI MANIS (13 users)
        {"username": "candidate1_pm", "password": "Test123!"},
        {"username": "candidate2_pm", "password": "Test123!"},
        {"username": "candidate3_pm", "password": "Test123!"},
        {"username": "assistant1_pm", "password": "Test123!"},
        {"username": "assistant2_pm", "password": "Test123!"},
        {"username": "assistant3_pm", "password": "Test123!"},
        {"username": "superuser1_pm", "password": "Test123!"},
        {"username": "superuser2_pm", "password": "Test123!"},
        {"username": "pdm1_pm", "password": "Test123!"},
        {"username": "pdm2_pm", "password": "Test123!"},
        {"username": "pdm3_pm", "password": "Test123!"},
        {"username": "pdm4_pm", "password": "Test123!"},
        {"username": "pdm5_pm", "password": "Test123!"},
        
        # KAWANG (14 users)
        {"username": "candidate1_kw", "password": "Test123!"},
        {"username": "candidate2_kw", "password": "Test123!"},
        {"username": "candidate3_kw", "password": "Test123!"},
        {"username": "assistant1_kw", "password": "Test123!"},
        {"username": "assistant2_kw", "password": "Test123!"},
        {"username": "assistant3_kw", "password": "Test123!"},
        {"username": "superuser1_kw", "password": "Test123!"},
        {"username": "superuser2_kw", "password": "Test123!"},
        {"username": "pdm1_kw", "password": "Test123!"},
        {"username": "pdm2_kw", "password": "Test123!"},
        {"username": "pdm3_kw", "password": "Test123!"},
        {"username": "pdm4_kw", "password": "Test123!"},
        {"username": "pdm5_kw", "password": "Test123!"},
        {"username": "pdm6_kw", "password": "Test123!"},
        
        # LIMBAHAU (17 users)
        {"username": "candidate1_lb", "password": "Test123!"},
        {"username": "candidate2_lb", "password": "Test123!"},
        {"username": "candidate3_lb", "password": "Test123!"},
        {"username": "assistant1_lb", "password": "Test123!"},
        {"username": "assistant2_lb", "password": "Test123!"},
        {"username": "assistant3_lb", "password": "Test123!"},
        {"username": "superuser1_lb", "password": "Test123!"},
        {"username": "superuser2_lb", "password": "Test123!"},
        {"username": "pdm1_lb", "password": "Test123!"},
        {"username": "pdm2_lb", "password": "Test123!"},
        {"username": "pdm3_lb", "password": "Test123!"},
        {"username": "pdm4_lb", "password": "Test123!"},
        {"username": "pdm5_lb", "password": "Test123!"},
        {"username": "pdm6_lb", "password": "Test123!"},
        {"username": "pdm7_lb", "password": "Test123!"},
        {"username": "pdm8_lb", "password": "Test123!"},
        {"username": "pdm9_lb", "password": "Test123!"},
    ]
    
    print("=" * 70)
    print("FIX ALL USER PASSWORDS (40 USERS)")
    print("=" * 70)
    print(f"\nTotal users to process: {len(users_to_fix)}")
    
    success_count = 0
    fail_count = 0
    not_found_count = 0
    
    for idx, user_info in enumerate(users_to_fix, 1):
        username = user_info["username"]
        password = user_info["password"]
        
        print(f"\n[{idx}/{len(users_to_fix)}] Processing: {username}")
        
        try:
            # Generate new hash
            new_hash = hash_password(password)
            
            # Verify the hash works
            if not verify_password(password, new_hash):
                print(f"  [FAIL] Hash verification failed!")
                fail_count += 1
                continue
            
            # Check if user exists and update
            response = supabase.table("users").select("*").eq("username", username).execute()
            
            if not response.data or len(response.data) == 0:
                print(f"  [NOT FOUND] User '{username}' not in database")
                not_found_count += 1
                continue
            
            user = response.data[0]
            
            # Update password hash
            supabase.table("users").update({
                "password_hash": new_hash
            }).eq("id", user["id"]).execute()
            
            print(f"  [OK] Password updated successfully")
            success_count += 1
            
        except Exception as e:
            print(f"  [ERROR] {str(e)}")
            fail_count += 1
    
    # Summary
    print("\n" + "=" * 70)
    print("PASSWORD UPDATE SUMMARY")
    print("=" * 70)
    print(f"[OK] Successfully updated: {success_count} users")
    if not_found_count > 0:
        print(f"[WARNING] Not found in database: {not_found_count} users")
    if fail_count > 0:
        print(f"[FAIL] Failed to update: {fail_count} users")
    print("=" * 70)
    
    if not_found_count > 0:
        print("\n[TIP] Users not found in database need to be created first.")
        print("      Run the user_schema.sql script in Supabase SQL Editor.")
    
    print("\nDefault passwords set:")
    print("  Super Admin: Admin123!")
    print("  All Others: Test123!")
    print("\n[IMPORTANT] Users should change passwords on first login!")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    fix_all_user_passwords()