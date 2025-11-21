"""
Script to upload voter data from CSV to Supabase
Usage: python utils/upload_data.py <path_to_csv>
"""

import sys
import csv
from pathlib import Path

# Add parent directory to path so we can import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.database import supabase

def upload_voters_from_csv(csv_path: str):
    """Upload voter data from CSV to Supabase"""
    
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
    batch_size = 1000
    total_batches = (len(voters_data) + batch_size - 1) // batch_size
    
    print(f"\n⬆️  Uploading data in {total_batches} batches...")
    
    for i in range(0, len(voters_data), batch_size):
        batch = voters_data[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        
        print(f"   Batch {batch_num}/{total_batches} ({len(batch)} records)...", end=" ")
        
        try:
            response = supabase.table('voters').insert(batch).execute()
            print("✅")
        except Exception as e:
            print(f"❌")
            print(f"   Error: {e}")
            return False
    
    print("\n" + "="*60)
    print("🎉 SUCCESS! All data uploaded to Supabase!")
    print("="*60)
    print(f"\n📊 Statistics:")
    print(f"   Total voters uploaded: {len(voters_data):,}")
    print(f"   Batches processed: {total_batches}")
    print("="*60 + "\n")
    
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upload_data.py <path_to_csv>")
        print("Example: python upload_data.py ../../daftar_pemilih.csv")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    
    if not Path(csv_file).exists():
        print(f"❌ Error: File not found: {csv_file}")
        sys.exit(1)
    
    print("="*60)
    print("📊 Voter Data Upload to Supabase")
    print("="*60)
    
    upload_voters_from_csv(csv_file)