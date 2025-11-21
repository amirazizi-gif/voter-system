# 🚀 Quick Setup Guide

Get your voter database running in 20 minutes!

## 📋 What You Need

- ✅ Node.js 18+ installed
- ✅ Python 3.9+ installed  
- ✅ Supabase account (free)
- ✅ 20 minutes

## ⚡ Step-by-Step Setup

### Step 1: Create Supabase Database (5 min)

1. Go to https://supabase.com and sign up
2. Click "New Project"
3. Name it `voter-database`
4. Choose a password and region
5. Wait 2 minutes for setup

6. Go to **SQL Editor** → **New Query**
7. Copy the SQL from `docs/database_schema.sql`
8. Click **Run**

9. Go to **Settings** → **API**
10. Copy these 3 values:
    - Project URL
    - anon public key
    - service_role key

### Step 2: Setup Frontend (5 min)

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create env file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# Use: Project URL and anon public key

# Start development server
npm run dev
```

Open http://localhost:3000 (won't have data yet)

### Step 3: Upload Data (5 min)

```bash
# Navigate to backend
cd ../backend

# Create virtual environment
python -m venv venv

# Activate it
source venv/bin/activate  # Mac/Linux
# OR
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Create env file
cp .env.example .env

# Edit .env with your Supabase credentials
# Use: Project URL and service_role key

# Upload the CSV data
python utils/upload_data.py ../daftar_pemilih.csv
```

Wait 1-2 minutes for upload to complete.

### Step 4: Test It! (5 min)

1. Go back to http://localhost:3000
2. Refresh the page
3. You should see 62,141 voters!
4. Test the filters
5. Try tagging a voter
6. Export to CSV

## 🌐 Deploy to Production

### Deploy Frontend (Vercel)

```bash
cd frontend

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variables when prompted:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Your site will be live at: `https://your-project.vercel.app`

## ✅ Checklist

Before going live, verify:

- [ ] Supabase project created
- [ ] SQL schema executed
- [ ] Frontend .env.local configured
- [ ] Backend .env configured
- [ ] Data uploaded successfully
- [ ] Frontend shows voter data
- [ ] Filters work
- [ ] Tags can be updated
- [ ] Export works
- [ ] Deployed to Vercel

## 🆘 Quick Fixes

**Problem: Frontend shows no data**
- Check .env.local has correct credentials
- Verify data was uploaded (check Supabase Table Editor)
- Check browser console (F12) for errors

**Problem: Upload script fails**
- Make sure you're using service_role key (not anon)
- Verify virtual environment is activated
- Check CSV file path is correct

**Problem: Can't update tags**
- Verify RLS policies are set up in Supabase
- Check you're using anon key in frontend (not service_role)

## 📞 Need Help?

1. Check the main README.md
2. Review the full documentation
3. Check Supabase dashboard for errors
4. Look at browser console (F12)

## 💰 Cost

Everything is **FREE**:
- Supabase: Free tier (500MB, more than enough)
- Vercel: Free tier (100GB bandwidth)
- Total: **$0/month**

---

**Ready to start? Begin with Step 1! 🎉**