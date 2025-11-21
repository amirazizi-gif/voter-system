"""
Script to upload voter data from CSV to Supabase (with network retry)
Usage: python utils/upload_data_robust.py <path_to_csv>
"""

import sys
import csv
import time
from pathlib import Path

# Add parent directory to path so we can import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.database import supabase

def upload_voters_from_csv(csv_path: str, max_retries: int = 3):
    """Upload voter data from CSV to Supabase with retry logic"""
    
    print(f"\n📖 Reading CSV file: {csv_path}")
    voters_data = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            
            for row in csv_reader:
                voter = {
                    'bil': int(row['BIL']),
                    'no_kp': row['NO K/P'],
                    'no_kp_id_lain': row['NO K/P ID LAIN'] if row['NO K/P ID LAIN'] else None,
                    'jantina': row['JANTINA'],
                    'tahun_lahir': int(row['TAHUN LAHIR']),
                    'nama_pemilih': row['NAMA PEMILIH'],
                    'kod_daerah_mengundi': row['KOD DAERAH MENGUNDI'],
                    'daerah_mengundi': row['DAERAH MENGUNDI'],
                    'kod_lokaliti': row['KOD LOKALITI'],
                    'lokaliti': row['LOKALITI'],
                    'tag': None
                }
                voters_data.append(voter)
    except FileNotFoundError:
        print(f"❌ Error: CSV file not found at {csv_path}")
        return False
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        return False
    
    print(f"✅ Read {len(voters_data):,} voter records")
    
    # Upload in batches
    batch_size = 500  # Smaller batches for better reliability
    total_batches = (len(voters_data) + batch_size - 1) // batch_size
    
    print(f"\n⬆️  Uploading data in {total_batches} batches...")
    print(f"    (Using smaller batches of {batch_size} for reliability)")
    
    failed_batches = []
    
    for i in range(0, len(voters_data), batch_size):
        batch = voters_data[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        
        print(f"   Batch {batch_num}/{total_batches} ({len(batch)} records)...", end=" ", flush=True)
        
        # Retry logic
        success = False
        for attempt in range(1, max_retries + 1):
            try:
                response = supabase.table('voters').insert(batch).execute()
                print("✅")
                success = True
                break
            except Exception as e:
                error_msg = str(e)
                
                # Check if it's a network error
                if "getaddrinfo failed" in error_msg or "Network" in error_msg or "Connection" in error_msg:
                    if attempt < max_retries:
                        print(f"⚠️ (Network error, retry {attempt}/{max_retries})", end=" ", flush=True)
                        time.sleep(2)  # Wait 2 seconds before retry
                    else:
                        print(f"❌ Network error after {max_retries} retries")
                        failed_batches.append((batch_num, batch, error_msg))
                else:
                    print(f"❌")
                    print(f"      Error: {error_msg}")
                    failed_batches.append((batch_num, batch, error_msg))
                    break
        
        if not success and batch_num not in [fb[0] for fb in failed_batches]:
            failed_batches.append((batch_num, batch, "Failed after all retries"))
        
        # Small delay between batches to avoid rate limiting
        if success and batch_num % 10 == 0:
            time.sleep(1)
    
    # Summary
    print("\n" + "="*60)
    
    if len(failed_batches) == 0:
        print("🎉 SUCCESS! All data uploaded to Supabase!")
        print("="*60)
        print(f"\n📊 Statistics:")
        print(f"   Total voters uploaded: {len(voters_data):,}")
        print(f"   Batches processed: {total_batches}")
        print("="*60 + "\n")
        return True
    else:
        print(f"⚠️  Upload completed with {len(failed_batches)} failed batches")
        print("="*60)
        print(f"\n📊 Statistics:")
        print(f"   Successfully uploaded: {(total_batches - len(failed_batches)) * batch_size:,} voters")
        print(f"   Failed batches: {len(failed_batches)}")
        print(f"\nFailed batch numbers: {[fb[0] for fb in failed_batches]}")
        print("\nTo retry failed batches, check your network connection and run again.")
        print("="*60 + "\n")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upload_data_robust.py <path_to_csv>")
        print("Example: python upload_data_robust.py ../daftar_pemilih.csv")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    
    if not Path(csv_file).exists():
        print(f"❌ Error: File not found: {csv_file}")
        sys.exit(1)
    
    print("="*60)
    print("📊 Voter Data Upload to Supabase (Robust Version)")
    print("="*60)
    print("\nThis version includes:")
    print("  • Automatic retry on network errors (3 attempts)")
    print("  • Smaller batch sizes (500 instead of 1000)")
    print("  • Delays between batches to avoid rate limiting")
    print("\n" + "="*60)
    
    # Check network first
    print("\n🔍 Checking network connection...")
    try:
        # Try a simple query to test connection
        test = supabase.table('voters').select('id').limit(1).execute()
        print("✅ Network connection is good!")
    except Exception as e:
        print("❌ Network connection issue detected!")
        print(f"   Error: {e}")
        print("\n💡 Troubleshooting tips:")
        print("   1. Check your internet connection")
        print("   2. Try disabling VPN if you have one")
        print("   3. Check firewall/antivirus settings")
        print("   4. Try using mobile hotspot")
        print()
        response = input("Do you want to continue anyway? (yes/no): ")
        if response.lower() != 'yes':
            print("Upload cancelled.")
            sys.exit(0)
    
    print()
    upload_voters_from_csv(csv_file)