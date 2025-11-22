"""
Diagnostic and Fix Script for DUN Issues
This script will:
1. Check what DUN values exist in the voters table
2. Check what DUN values exist in the users table
3. Identify mismatches
4. Provide fix SQL statements
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'backend'))

from config.database import supabase

def diagnose_dun_issues():
    """Diagnose DUN-related issues"""
    
    print("=" * 70)
    print("DUN DIAGNOSTIC TOOL")
    print("=" * 70)
    
    # 1. Check voters table for DUN values
    print("\n[STEP 1] Checking DUN values in VOTERS table...")
    voters_response = supabase.table('voters').select('dun').execute()
    
    if voters_response.data:
        # Get unique DUN values and their counts
        dun_counts = {}
        null_count = 0
        
        for row in voters_response.data:
            dun = row.get('dun')
            if dun:
                dun_counts[dun] = dun_counts.get(dun, 0) + 1
            else:
                null_count += 1
        
        print(f"\n[OK] Found {len(voters_response.data)} total voter records")
        print(f"\n[INFO] DUN Distribution in Voters Table:")
        print("-" * 70)
        
        if dun_counts:
            for dun, count in sorted(dun_counts.items()):
                print(f"   {dun:<30} {count:>10,} voters")
        
        if null_count > 0:
            print(f"   {'(NULL - No DUN assigned)':<30} {null_count:>10,} voters")
            print(f"\n[WARNING] {null_count} voters have no DUN assigned!")
    else:
        print("[ERROR] No voters found in database!")
        return
    
    # 2. Check users table for DUN values
    print("\n[STEP 2] Checking DUN values in USERS table...")
    users_response = supabase.table('users').select('username, dun, role').execute()
    
    if users_response.data:
        user_duns = {}
        no_dun_users = []
        
        for user in users_response.data:
            dun = user.get('dun')
            username = user.get('username')
            role = user.get('role')
            
            if dun:
                if dun not in user_duns:
                    user_duns[dun] = []
                user_duns[dun].append(f"{username} ({role})")
            else:
                if role != 'super_admin':  # Super admin doesn't need DUN
                    no_dun_users.append(f"{username} ({role})")
        
        print(f"\n[OK] Found {len(users_response.data)} total users")
        print(f"\n[INFO] DUN Assignment in Users Table:")
        print("-" * 70)
        
        for dun in sorted(user_duns.keys()):
            print(f"   {dun}:")
            for user in user_duns[dun]:
                print(f"      - {user}")
        
        if no_dun_users:
            print(f"\n   (No DUN assigned):")
            for user in no_dun_users:
                print(f"      - {user}")
    
    # 3. Identify mismatches
    print("\n[STEP 3] Identifying Mismatches...")
    print("-" * 70)
    
    voter_duns = set(dun_counts.keys())
    user_duns_set = set(user_duns.keys())
    
    # DUNs in voters but not in users
    orphan_voters = voter_duns - user_duns_set
    if orphan_voters:
        print(f"\n[WARNING] DUNs with VOTERS but NO USERS:")
        for dun in sorted(orphan_voters):
            print(f"   - {dun} ({dun_counts[dun]:,} voters with no users to access them)")
    
    # DUNs in users but not in voters
    orphan_users = user_duns_set - voter_duns
    if orphan_users:
        print(f"\n[WARNING] DUNs with USERS but NO VOTERS:")
        for dun in sorted(orphan_users):
            print(f"   - {dun} (users can't see any voters)")
            for user in user_duns[dun]:
                print(f"      - {user}")
    
    # Perfect matches
    matching_duns = voter_duns & user_duns_set
    if matching_duns:
        print(f"\n[OK] DUNs with BOTH voters and users (working correctly):")
        for dun in sorted(matching_duns):
            print(f"   - {dun} ({dun_counts[dun]:,} voters, {len(user_duns[dun])} users)")
    
    # 4. Generate fix SQL
    print("\n" + "=" * 70)
    print("[FIX] RECOMMENDED FIXES")
    print("=" * 70)
    
    if null_count > 0:
        print("\n[WARNING] You have voters with NULL DUN values!")
        print("   These voters are invisible to all non-super-admin users.")
        print("\n   Possible fixes:")
        print("   1. If ALL voters should belong to one DUN, run:")
        print(f"      UPDATE voters SET dun = 'Pantai Manis' WHERE dun IS NULL;")
        print("\n   2. If voters are from different DUNs, you need to:")
        print("      - Identify which voters belong to which DUN")
        print("      - Update them individually or by area")
    
    if orphan_users:
        print(f"\n[WARNING] Users assigned to non-existent DUNs!")
        print("   These users will see 0 voters.")
        print("\n   FIX OPTIONS:")
        
        for dun in sorted(orphan_users):
            print(f"\n   For DUN: {dun}")
            print(f"   Affected users: {', '.join([u.split(' ')[0] for u in user_duns[dun]])}")
            
            if voter_duns:
                closest_match = min(voter_duns, key=lambda x: len(set(x.lower()) ^ set(dun.lower())))
                print(f"   Closest matching DUN in voters: {closest_match}")
                print(f"\n   SQL Fix (if this is the correct DUN):")
                for user in user_duns[dun]:
                    username = user.split(' ')[0]
                    print(f"   UPDATE users SET dun = '{closest_match}' WHERE username = '{username}';")
    
    print("\n" + "=" * 70)
    print("[SUMMARY]")
    print("=" * 70)
    print(f"Total voters: {len(voters_response.data):,}")
    print(f"Total users: {len(users_response.data)}")
    print(f"DUNs with voters: {len(voter_duns)}")
    print(f"DUNs with users: {len(user_duns_set)}")
    print(f"Matching DUNs: {len(matching_duns)}")
    print(f"Voters with NULL DUN: {null_count:,}")
    print("=" * 70)

if __name__ == "__main__":
    try:
        diagnose_dun_issues()
    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()