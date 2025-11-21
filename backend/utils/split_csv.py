"""
Split large SQL file into smaller chunks for Supabase upload
Usage: python utils/split_sql.py <input_sql> <statements_per_file>
"""

import sys
from pathlib import Path

def split_sql_file(input_file, statements_per_file=100):
    """Split SQL INSERT statements into smaller files"""
    
    output_dir = Path('sql_chunks')
    output_dir.mkdir(exist_ok=True)
    
    print(f"📖 Reading {input_file}...")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by batch comments
    batches = content.split('-- Batch ')
    
    # First part is header
    header = batches[0]
    batches = batches[1:]  # Remove header
    
    print(f"Found {len(batches)} batches")
    
    file_num = 1
    current_statements = [header]
    statements_in_file = 0
    
    for batch in batches:
        current_statements.append('-- Batch ' + batch)
        statements_in_file += 1
        
        if statements_in_file >= statements_per_file:
            # Write to file
            output_file = output_dir / f'voters_insert_part_{file_num:02d}.sql'
            with open(output_file, 'w', encoding='utf-8') as out:
                out.write('\n'.join(current_statements))
            
            print(f"✅ Created {output_file.name} ({statements_in_file} batches)")
            
            file_num += 1
            current_statements = [header]
            statements_in_file = 0
    
    # Write remaining
    if statements_in_file > 0:
        output_file = output_dir / f'voters_insert_part_{file_num:02d}.sql'
        with open(output_file, 'w', encoding='utf-8') as out:
            out.write('\n'.join(current_statements))
        
        print(f"✅ Created {output_file.name} ({statements_in_file} batches)")
    
    print(f"\n" + "="*60)
    print(f"✅ Split complete!")
    print(f"   Output directory: {output_dir.absolute()}")
    print("="*60)
    print(f"\nNext steps:")
    print(f"1. Go to Supabase SQL Editor")
    print(f"2. Run each SQL file one by one")
    print(f"3. Files are in: {output_dir.absolute()}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python split_sql.py <input_sql> [statements_per_file]")
        print("Example: python split_sql.py voters_insert.sql 100")
        sys.exit(1)
    
    input_file = sys.argv[1]
    statements_per_file = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    
    if not Path(input_file).exists():
        print(f"❌ File not found: {input_file}")
        sys.exit(1)
    
    split_sql_file(input_file, statements_per_file)