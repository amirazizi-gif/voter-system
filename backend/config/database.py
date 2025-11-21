"""
Supabase Database Configuration

This module handles the connection to Supabase PostgreSQL database.
It loads credentials from environment variables and creates a client instance.

Environment Variables Required:
    - SUPABASE_URL: Your Supabase project URL
    - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key

Usage:
    from config.database import supabase
    
    # Query data
    response = supabase.table('voters').select('*').execute()
    
    # Insert data
    supabase.table('voters').insert({'name': 'John Doe'}).execute()
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env file
# Look for .env in the backend directory
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Get Supabase configuration from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Validate that required environment variables are set
if not SUPABASE_URL:
    raise ValueError(
        "Missing SUPABASE_URL environment variable.\n"
        "Please create a .env file in the backend/ directory with:\n"
        "SUPABASE_URL=your_supabase_project_url"
    )

if not SUPABASE_SERVICE_KEY:
    raise ValueError(
        "Missing SUPABASE_SERVICE_ROLE_KEY environment variable.\n"
        "Please create a .env file in the backend/ directory with:\n"
        "SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key"
    )

# Validate URL format
if not SUPABASE_URL.startswith('https://'):
    raise ValueError(
        f"Invalid SUPABASE_URL format: {SUPABASE_URL}\n"
        "URL should start with 'https://' and look like:\n"
        "https://your-project-id.supabase.co"
    )

# Initialize Supabase client with service role key
# Note: Service role key bypasses Row Level Security (RLS)
# Use this only for backend operations, never expose it in frontend
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print(f"[OK] Connected to Supabase at {SUPABASE_URL}")
except Exception as e:
    raise ConnectionError(
        f"Failed to connect to Supabase: {str(e)}\n"
        "Please check your credentials and network connection."
    )

# Export the client for use in other modules
__all__ = ['supabase', 'SUPABASE_URL']