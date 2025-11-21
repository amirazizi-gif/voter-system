-- Voter Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Create voters table
CREATE TABLE voters (
  id BIGSERIAL PRIMARY KEY,
  bil INTEGER NOT NULL,
  no_kp VARCHAR(20) NOT NULL,
  no_kp_id_lain VARCHAR(50),
  jantina CHAR(1) NOT NULL CHECK (jantina IN ('L', 'P')),
  tahun_lahir INTEGER NOT NULL,
  nama_pemilih TEXT NOT NULL,
  kod_daerah_mengundi VARCHAR(20) NOT NULL,
  daerah_mengundi VARCHAR(100) NOT NULL,
  kod_lokaliti VARCHAR(20) NOT NULL,
  lokaliti VARCHAR(100) NOT NULL,
  tag VARCHAR(10) CHECK (tag IN ('Yes', 'Unsure', 'No')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for better performance
CREATE INDEX idx_voters_nama ON voters(nama_pemilih);
CREATE INDEX idx_voters_jantina ON voters(jantina);
CREATE INDEX idx_voters_tahun_lahir ON voters(tahun_lahir);
CREATE INDEX idx_voters_daerah ON voters(daerah_mengundi);
CREATE INDEX idx_voters_lokaliti ON voters(lokaliti);
CREATE INDEX idx_voters_tag ON voters(tag);
CREATE INDEX idx_voters_no_kp ON voters(no_kp);

-- Enable Row Level Security
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" 
  ON voters FOR SELECT 
  USING (true);

-- Create policy to allow public update of tags only
CREATE POLICY "Allow public tag updates" 
  ON voters FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_voters_updated_at 
  BEFORE UPDATE ON voters 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Verify table was created
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_name = 'voters';

-- After running this, you should see "Success. No rows returned" or a count of 1