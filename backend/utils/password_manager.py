#!/usr/bin/env python3
"""
Password Management Utility
Generate password hashes and manage user passwords
"""

import sys
import os
from getpass import getpass

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.auth import hash_password, verify_password
from config.database import supabase


def print_header(title):
    """Print formatted header"""
    print("\n" + "=" * 60)
    print(f"   {title}")
    print("=" * 60 + "\n")


def generate_hash():
    """Generate password hash"""
    print_header("PASSWORD HASH GENERATOR")
    
    while True:
        print("Enter password to hash (or 'q' to quit)")
        password = getpass("Password: ")
        
        if password.lower() == 'q':
            break
        
        if len(password) < 8:
            print("❌ Password must be at least 8 characters long\n")
            continue
        
        # Confirm password
        confirm = getpass("Confirm password: ")
        
        if password != confirm:
            print("❌ Passwords don't match\n")
            continue
        
        # Generate hash
        hashed = hash_password(password)
        
        print("\n✅ Password hashed successfully!")
        print("\n📋 Copy this hash:\n")
        print(hashed)
        print("\n💡 Use this in SQL:")
        print(f"UPDATE users SET password_hash = '{hashed}' WHERE username = 'username';")
        print("\n" + "-" * 60 + "\n")


def change_user_password():
    """Change password for a user"""
    print_header("CHANGE USER PASSWORD")
    
    username = input("Enter username: ").strip()
    
    if not username:
        print("❌ Username cannot be empty")
        return
    
    # Check if user exists
    try:
        response = supabase.table('users').select('id, username, full_name').eq('username', username).execute()
        
        if not response.data:
            print(f"❌ User '{username}' not found")
            return
        
        user = response.data[0]
        print(f"\n✅ Found user: {user['full_name']} ({user['username']})")
        
    except Exception as e:
        print(f"❌ Error checking user: {e}")
        return
    
    # Get new password
    print("\nEnter new password:")
    new_password = getpass("Password: ")
    
    if len(new_password) < 8:
        print("❌ Password must be at least 8 characters long")
        return
    
    confirm = getpass("Confirm password: ")
    
    if new_password != confirm:
        print("❌ Passwords don't match")
        return
    
    # Hash and update
    try:
        new_hash = hash_password(new_password)
        
        supabase.table('users').update({
            'password_hash': new_hash
        }).eq('id', user['id']).execute()
        
        print(f"\n✅ Password changed successfully for {user['username']}")
        print("   User must login again with new password")
        
        # Log the change
        supabase.table('audit_log').insert({
            'user_id': user['id'],
            'action': 'password_reset_by_admin'
        }).execute()
        
    except Exception as e:
        print(f"❌ Error updating password: {e}")


def list_users():
    """List all users"""
    print_header("USER LIST")
    
    try:
        response = supabase.table('users').select('username, full_name, role, dun, is_active').order('dun, role, username').execute()
        
        if not response.data:
            print("No users found")
            return
        
        print(f"{'Username':<20} {'Full Name':<30} {'Role':<20} {'DUN':<15} {'Active'}")
        print("-" * 105)
        
        for user in response.data:
            username = user['username']
            full_name = user['full_name'][:28] if len(user['full_name']) > 28 else user['full_name']
            role = user['role']
            dun = user.get('dun', 'N/A') or 'N/A'
            active = '✅' if user['is_active'] else '❌'
            
            print(f"{username:<20} {full_name:<30} {role:<20} {dun:<15} {active}")
        
        print("\nTotal users:", len(response.data))
        
    except Exception as e:
        print(f"❌ Error listing users: {e}")


def toggle_user_status():
    """Enable or disable a user"""
    print_header("ENABLE/DISABLE USER")
    
    username = input("Enter username: ").strip()
    
    if not username:
        print("❌ Username cannot be empty")
        return
    
    try:
        response = supabase.table('users').select('id, username, full_name, is_active').eq('username', username).execute()
        
        if not response.data:
            print(f"❌ User '{username}' not found")
            return
        
        user = response.data[0]
        current_status = user['is_active']
        new_status = not current_status
        
        print(f"\nUser: {user['full_name']} ({user['username']})")
        print(f"Current status: {'Active ✅' if current_status else 'Disabled ❌'}")
        print(f"New status: {'Active ✅' if new_status else 'Disabled ❌'}")
        
        confirm = input("\nConfirm change? (yes/no): ").lower()
        
        if confirm != 'yes':
            print("Operation cancelled")
            return
        
        supabase.table('users').update({
            'is_active': new_status
        }).eq('id', user['id']).execute()
        
        print(f"\n✅ User {user['username']} {'enabled' if new_status else 'disabled'}")
        
        # Log the change
        supabase.table('audit_log').insert({
            'user_id': user['id'],
            'action': 'user_status_changed',
            'new_value': {'is_active': new_status}
        }).execute()
        
    except Exception as e:
        print(f"❌ Error updating user: {e}")


def bulk_password_reset():
    """Generate passwords for all test users"""
    print_header("BULK PASSWORD RESET")
    
    print("⚠️  This will generate NEW passwords for all test users")
    print("    (candidate*, assistant*, superuser*, pdm* accounts)")
    print()
    
    confirm = input("Continue? (yes/no): ").lower()
    
    if confirm != 'yes':
        print("Operation cancelled")
        return
    
    print("\nEnter new password for all test accounts:")
    new_password = getpass("Password: ")
    
    if len(new_password) < 8:
        print("❌ Password must be at least 8 characters long")
        return
    
    confirm_pass = getpass("Confirm password: ")
    
    if new_password != confirm_pass:
        print("❌ Passwords don't match")
        return
    
    try:
        # Get all test users
        response = supabase.table('users').select('id, username').execute()
        
        test_users = [u for u in response.data if u['username'] != 'superadmin']
        
        print(f"\nFound {len(test_users)} test users")
        print("Updating passwords...\n")
        
        new_hash = hash_password(new_password)
        
        for user in test_users:
            try:
                supabase.table('users').update({
                    'password_hash': new_hash
                }).eq('id', user['id']).execute()
                
                print(f"✅ {user['username']}")
                
            except Exception as e:
                print(f"❌ {user['username']}: {e}")
        
        print(f"\n✅ Password reset complete for {len(test_users)} users")
        print(f"   New password: {new_password}")
        print("\n⚠️  IMPORTANT: Save this password securely!")
        
    except Exception as e:
        print(f"❌ Error: {e}")


def main_menu():
    """Display main menu"""
    while True:
        print_header("PASSWORD MANAGEMENT UTILITY")
        
        print("1. Generate password hash")
        print("2. Change user password")
        print("3. List all users")
        print("4. Enable/Disable user")
        print("5. Bulk password reset (all test users)")
        print("6. Exit")
        print()
        
        choice = input("Select option (1-6): ").strip()
        
        if choice == '1':
            generate_hash()
        elif choice == '2':
            change_user_password()
        elif choice == '3':
            list_users()
        elif choice == '4':
            toggle_user_status()
        elif choice == '5':
            bulk_password_reset()
        elif choice == '6':
            print("\n👋 Goodbye!\n")
            break
        else:
            print("\n❌ Invalid option. Please try again.\n")


if __name__ == "__main__":
    try:
        main_menu()
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!\n")
    except Exception as e:
        print(f"\n❌ Error: {e}\n")