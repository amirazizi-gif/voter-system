"""
Optional FastAPI backend for advanced features
The frontend can work directly with Supabase, but this provides additional API endpoints if needed
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from config.database import supabase

app = FastAPI(title="Voter Database API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VoterUpdate(BaseModel):
    tag: Optional[str] = None

class VoterFilters(BaseModel):
    name_search: Optional[str] = None
    gender: Optional[str] = None
    daerah: Optional[str] = None
    lokaliti: Optional[str] = None
    tag: Optional[str] = None

@app.get("/")
def root():
    return {
        "message": "Voter Database API",
        "version": "1.0.0",
        "endpoints": {
            "GET /api/voters": "Get all voters with optional filters",
            "GET /api/voters/{voter_id}": "Get specific voter",
            "PATCH /api/voters/{voter_id}": "Update voter tag",
            "GET /api/stats": "Get statistics",
            "GET /api/daerah": "Get unique daerah list",
            "GET /api/lokaliti": "Get unique lokaliti list"
        }
    }

@app.get("/api/voters")
def get_voters(
    name: Optional[str] = None,
    gender: Optional[str] = None,
    daerah: Optional[str] = None,
    lokaliti: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get voters with optional filters"""
    try:
        query = supabase.table('voters').select('*')
        
        if name:
            query = query.ilike('nama_pemilih', f'%{name}%')
        if gender:
            query = query.eq('jantina', gender)
        if daerah:
            query = query.eq('daerah_mengundi', daerah)
        if lokaliti:
            query = query.eq('lokaliti', lokaliti)
        if tag:
            if tag == 'untagged':
                query = query.is_('tag', 'null')
            else:
                query = query.eq('tag', tag)
        
        response = query.range(offset, offset + limit - 1).order('bil').execute()
        return {"data": response.data, "count": len(response.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/voters/{voter_id}")
def get_voter(voter_id: int):
    """Get specific voter by ID"""
    try:
        response = supabase.table('voters').select('*').eq('id', voter_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Voter not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/voters/{voter_id}")
def update_voter(voter_id: int, voter_update: VoterUpdate):
    """Update voter tag"""
    try:
        response = supabase.table('voters').update({
            'tag': voter_update.tag
        }).eq('id', voter_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Voter not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def get_statistics():
    """Get voter statistics"""
    try:
        # Get all voters
        all_voters = supabase.table('voters').select('tag').execute()
        
        total = len(all_voters.data)
        yes_count = sum(1 for v in all_voters.data if v.get('tag') == 'Yes')
        unsure_count = sum(1 for v in all_voters.data if v.get('tag') == 'Unsure')
        no_count = sum(1 for v in all_voters.data if v.get('tag') == 'No')
        untagged = total - yes_count - unsure_count - no_count
        
        return {
            "total": total,
            "yes": yes_count,
            "unsure": unsure_count,
            "no": no_count,
            "untagged": untagged
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/daerah")
def get_daerah_list():
    """Get list of unique daerah"""
    try:
        response = supabase.table('voters').select('daerah_mengundi').execute()
        unique_daerah = list(set(v['daerah_mengundi'] for v in response.data))
        return sorted(unique_daerah)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/lokaliti")
def get_lokaliti_list():
    """Get list of unique lokaliti"""
    try:
        response = supabase.table('voters').select('lokaliti').execute()
        unique_lokaliti = list(set(v['lokaliti'] for v in response.data))
        return sorted(unique_lokaliti)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)