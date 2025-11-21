"""
Convert CSV to SQL INSERT statements
Use this if network upload fails - you can paste SQL directly in Supabase

Usage: python utils/csv_to_sql.py <csv_file> > output.sql
"""

import sys
import csv
from pathlib import Path

def escape_sql_string(value):
    """Escape single quotes in SQL strings"""
    if value is None:
        return 'NULL'
    return f"'{str(value).replace(chr(39), chr(39) + chr(39))}'"  # Escape single quotes

def csv_to_sql_inserts(csv_path: str, batch_size: int = 1000):
    """Convert CSV to SQL INSERT statements"""
    
    print("-- Voter Data SQL Insert Statements")
    print("-- Generated from CSV")
    print("-- Run this in Supabase SQL Editor")
    print()
    
    voters = []
    
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
            }
            voters.append(voter)
    
    # Generate INSERT statements in batches
    total_batches = (len(voters) + batch_size - 1) // batch_size
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(voters))
        batch = voters[start_idx:end_idx]
        
        print(f"-- Batch {batch_num + 1}/{total_batches}")
        print("INSERT INTO voters (bil, no_kp, no_kp_id_lain, jantina, tahun_lahir, nama_pemilih, kod_daerah_mengundi, daerah_mengundi, kod_lokaliti, lokaliti) VALUES")
        
        for i, voter in enumerate(batch):
            no_kp_id = escape_sql_string(voter['no_kp_id_lain'])
            nama = escape_sql_string(voter['nama_pemilih'])
            daerah = escape_sql_string(voter['daerah_mengundi'])
            lokaliti = escape_sql_string(voter['lokaliti'])
            
            values = (
                f"({voter['bil']}, "
                f"'{voter['no_kp']}', "
                f"{no_kp_id}, "
                f"'{voter['jantina']}', "
                f"{voter['tahun_lahir']}, "
                f"{nama}, "
                f"'{voter['kod_daerah_mengundi']}', "
                f"{daerah}, "
                f"'{voter['kod_lokaliti']}', "
                f"{lokaliti})"
            )
            
            if i < len(batch) - 1:
                print(f"  {values},")
            else:
                print(f"  {values};")
        
        print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python csv_to_sql.py <csv_file> > output.sql")
        print("Example: python csv_to_sql.py ../daftar_pemilih.csv > voters.sql")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    
    if not Path(csv_file).exists():
        print(f"Error: File not found: {csv_file}", file=sys.stderr)
        sys.exit(1)
    
    csv_to_sql_inserts(csv_file)