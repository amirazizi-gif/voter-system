"""
FastAPI Backend with Authentication & Authorization
Secure voter database API with role-based access control
"""

from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.database import supabase
from api.auth import router as auth_router, get_current_user, require_permission
from utils.auth import check_permission, can_access_dun

app = FastAPI(
    title="Voter Database API - Secure",
    version="2.0.0",
    description="Authenticated voter management system with role-based access control"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],  # Update with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include authentication router
app.include_router(auth_router)


# Pydantic Models
class VoterUpdate(BaseModel):
    tag: Optional[str] = None


class VoterFilters(BaseModel):
    name_search: Optional[str] = None
    gender: Optional[str] = None
    daerah: Optional[str] = None
    lokaliti: Optional[str] = None
    dun: Optional[str] = None
    tag: Optional[str] = None


@app.get("/")
def root():
    return {
        "message": "Voter Database API - Secure Version",
        "version": "2.0.0",
        "authentication": "Required - Use /api/auth/login",
        "endpoints": {
            "POST /api/auth/login": "Login with username and password",
            "POST /api/auth/logout": "Logout current session",
            "GET /api/auth/me": "Get current user info",
            "GET /api/voters": "Get voters (filtered by DUN access)",
            "GET /api/voters/{voter_id}": "Get specific voter",
            "PATCH /api/voters/{voter_id}": "Update voter tag (requires permission)",
            "GET /api/stats": "Get statistics (filtered by DUN access)",
            "GET /api/daerah": "Get unique daerah list",
            "GET /api/lokaliti": "Get unique lokaliti list",
            "GET /api/audit-logs": "Get audit logs (admin only)"
        }
    }


@app.get("/api/voters")
async def get_voters(
    request: Request,
    name: Optional[str] = None,
    gender: Optional[str] = None,
    daerah: Optional[str] = None,
    lokaliti: Optional[str] = None,
    dun: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Get voters with optional filters
    Users can only see voters from their assigned DUN (except super_admin)
    """
    try:
        query = supabase.table('voters').select('*')
        
        # Apply DUN restriction (unless super admin)
        if current_user['role'] != 'super_admin':
            if not current_user.get('dun'):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User has no DUN assignment"
                )
            query = query.eq('dun', current_user['dun'])
        
        # Apply additional filters
        if name:
            query = query.ilike('nama_pemilih', f'%{name}%')
        if gender:
            query = query.eq('jantina', gender)
        if daerah:
            query = query.eq('daerah_mengundi', daerah)
        if lokaliti:
            query = query.eq('lokaliti', lokaliti)
        if dun and current_user['role'] == 'super_admin':
            query = query.eq('dun', dun)
        if tag:
            if tag == 'untagged':
                query = query.is_('tag', 'null')
            else:
                query = query.eq('tag', tag)
        
        response = query.range(offset, offset + limit - 1).order('bil').execute()
        
        # Log access
        supabase.table('audit_log').insert({
            'user_id': current_user['id'],
            'action': 'view',
            'table_name': 'voters',
            'ip_address': request.client.host
        }).execute()
        
        return {"data": response.data, "count": len(response.data)}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/voters/{voter_id}")
async def get_voter(
    voter_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get specific voter by ID"""
    try:
        response = supabase.table('voters').select('*').eq('id', voter_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Voter not found")
        
        voter = response.data[0]
        
        # Check DUN access
        if current_user['role'] != 'super_admin':
            if voter.get('dun') != current_user.get('dun'):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this voter's DUN"
                )
        
        # Log access
        supabase.table('audit_log').insert({
            'user_id': current_user['id'],
            'action': 'view',
            'table_name': 'voters',
            'record_id': voter_id,
            'ip_address': request.client.host
        }).execute()
        
        return voter
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/voters/{voter_id}")
async def update_voter(
    voter_id: int,
    voter_update: VoterUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Update voter tag
    Requires 'update_voters' permission (Candidate, Super User, PDM roles)
    """
    try:
        # Check permission
        if not check_permission(current_user['role'], 'update_voters'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update voters"
            )
        
        # Get voter to check DUN access
        voter_response = supabase.table('voters').select('*').eq('id', voter_id).execute()
        
        if not voter_response.data:
            raise HTTPException(status_code=404, detail="Voter not found")
        
        voter = voter_response.data[0]
        
        # Check DUN access
        if current_user['role'] != 'super_admin':
            if voter.get('dun') != current_user.get('dun'):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot update voter from different DUN"
                )
        
        # Update voter
        response = supabase.table('voters').update({
            'tag': voter_update.tag,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', voter_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Update failed")
        
        # Audit log is created automatically by trigger
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def get_statistics(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get voter statistics
    Filtered by user's DUN (except super_admin)
    """
    try:
        query = supabase.table('voters').select('tag, dun')
        
        # Apply DUN filter
        if current_user['role'] != 'super_admin':
            query = query.eq('dun', current_user['dun'])
        
        all_voters = query.execute()
        
        total = len(all_voters.data)
        yes_count = sum(1 for v in all_voters.data if v.get('tag') == 'Yes')
        unsure_count = sum(1 for v in all_voters.data if v.get('tag') == 'Unsure')
        no_count = sum(1 for v in all_voters.data if v.get('tag') == 'No')
        untagged = total - yes_count - unsure_count - no_count
        
        # Calculate percentages
        yes_pct = (yes_count / total * 100) if total > 0 else 0
        unsure_pct = (unsure_count / total * 100) if total > 0 else 0
        no_pct = (no_count / total * 100) if total > 0 else 0
        untagged_pct = (untagged / total * 100) if total > 0 else 0
        
        # Log stats view
        supabase.table('audit_log').insert({
            'user_id': current_user['id'],
            'action': 'view_stats',
            'ip_address': request.client.host
        }).execute()
        
        return {
            "dun": current_user.get('dun', 'All'),
            "total": total,
            "yes": yes_count,
            "yes_percentage": round(yes_pct, 2),
            "unsure": unsure_count,
            "unsure_percentage": round(unsure_pct, 2),
            "no": no_count,
            "no_percentage": round(no_pct, 2),
            "untagged": untagged,
            "untagged_percentage": round(untagged_pct, 2)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/daerah")
async def get_daerah_list(current_user: dict = Depends(get_current_user)):
    """Get list of unique daerah (filtered by DUN)"""
    try:
        query = supabase.table('voters').select('daerah_mengundi')
        
        # Apply DUN filter
        if current_user['role'] != 'super_admin':
            query = query.eq('dun', current_user['dun'])
        
        response = query.execute()
        unique_daerah = list(set(v['daerah_mengundi'] for v in response.data if v.get('daerah_mengundi')))
        
        return sorted(unique_daerah)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/lokaliti")
async def get_lokaliti_list(current_user: dict = Depends(get_current_user)):
    """Get list of unique lokaliti (filtered by DUN)"""
    try:
        query = supabase.table('voters').select('lokaliti')
        
        # Apply DUN filter
        if current_user['role'] != 'super_admin':
            query = query.eq('dun', current_user['dun'])
        
        response = query.execute()
        unique_lokaliti = list(set(v['lokaliti'] for v in response.data if v.get('lokaliti')))
        
        return sorted(unique_lokaliti)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dun-list")
async def get_dun_list(current_user: dict = Depends(get_current_user)):
    """Get list of all DUNs (super_admin only)"""
    if current_user['role'] != 'super_admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can view all DUNs"
        )
    
    try:
        response = supabase.table('voters').select('dun').execute()
        unique_duns = list(set(v['dun'] for v in response.data if v.get('dun')))
        
        return sorted(unique_duns)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/audit-logs")
async def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(require_permission('view_audit_logs'))
):
    """Get audit logs (super_admin only)"""
    try:
        response = supabase.table('audit_log')\
            .select('*, users(username, full_name)')\
            .order('created_at', desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        return {"data": response.data, "count": len(response.data)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user-activity")
async def get_user_activity(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's recent activity"""
    try:
        response = supabase.table('audit_log')\
            .select('*')\
            .eq('user_id', current_user['id'])\
            .order('created_at', desc=True)\
            .limit(20)\
            .execute()
        
        return {"data": response.data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("🚀 Starting Secure Voter Database API")
    print("="*60)
    print("\n📝 Default Credentials (CHANGE IMMEDIATELY!):")
    print("   Username: superadmin")
    print("   Password: Admin123!")
    print("\n⚠️  Remember to:")
    print("   1. Change all default passwords")
    print("   2. Update CORS origins in production")
    print("   3. Use HTTPS in production")
    print("   4. Set SECRET_KEY from environment variable")
    print("\n" + "="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)