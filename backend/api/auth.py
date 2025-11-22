"""
FastAPI Authentication Router and Dependencies
Handles login, logout, password change, and user authentication
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional

from config.database import supabase
from utils.auth import verify_token, verify_password, create_access_token, check_permission, hash_password

router = APIRouter(prefix="/api/auth", tags=["authentication"])

security = HTTPBearer()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    must_change_password: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """
    Authenticate user and return JWT token
    """
    try:
        # Query user from Supabase
        response = supabase.table("users").select("*").eq("username", credentials.username).execute()
        
        if not response.data or len(response.data) == 0:
            print(f"[DEBUG] User '{credentials.username}' not found in database")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        user = response.data[0]
        print(f"[DEBUG] User found: {user.get('username')}, role: {user.get('role')}, active: {user.get('is_active')}")
        
        # Verify password
        password_hash = user.get("password_hash", "")
        if not password_hash:
            print(f"[DEBUG] No password_hash found for user '{credentials.username}'")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        password_valid = verify_password(credentials.password, password_hash)
        print(f"[DEBUG] Password verification result: {password_valid}")
        
        if not password_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Check if user is active
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
        
        # Create access token
        token_data = {
            "sub": str(user["id"]),
            "username": user["username"],
            "role": user.get("role", "candidate_assistant"),
            "dun": user.get("dun"),
            "user_id": user["id"]
        }
        access_token = create_access_token(data=token_data)
        
        # Return token and user info (without password)
        user_info = {
            "id": user["id"],
            "username": user["username"],
            "role": user.get("role", "candidate_assistant"),
            "dun": user.get("dun"),
            "full_name": user.get("full_name"),
            "email": user.get("email")
        }
        
        # Check if user must change password (default users)
        must_change = user.get("must_change_password", False)
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_info,
            must_change_password=must_change
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    FastAPI dependency to get current authenticated user from JWT token
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database to ensure they still exist and are active
    try:
        user_id = payload.get("user_id") or payload.get("sub")
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        user = response.data[0]
        
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
        
        # Return user info from token (faster than DB lookup on every request)
        return {
            "id": user["id"],
            "username": payload.get("username"),
            "role": payload.get("role", user.get("role", "candidate_assistant")),
            "dun": payload.get("dun") or user.get("dun"),
            "user_id": user["id"]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information
    """
    # Get full user data including must_change_password flag
    response = supabase.table("users").select("id, username, full_name, role, dun, email, must_change_password").eq("id", current_user["id"]).execute()
    
    if response.data and len(response.data) > 0:
        return response.data[0]
    
    return current_user


@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Change user password
    Requires current password for verification
    """
    try:
        # Get user from database
        user_id = current_user.get("user_id") or current_user.get("id")
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user = response.data[0]
        
        # Verify current password
        if not verify_password(password_data.current_password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect"
            )
        
        # Validate new password strength
        if len(password_data.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters long"
            )
        
        # Check if new password is same as current
        if password_data.current_password == password_data.new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current password"
            )
        
        # Hash new password
        new_hash = hash_password(password_data.new_password)
        
        # Update password and set must_change_password to False
        supabase.table("users").update({
            "password_hash": new_hash,
            "must_change_password": False
        }).eq("id", user_id).execute()
        
        # Log the password change
        supabase.table("audit_log").insert({
            "user_id": user_id,
            "action": "password_changed",
            "table_name": "users"
        }).execute()
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to change password: {str(e)}"
        )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout user (token invalidation handled client-side)
    """
    return {"message": "Logged out successfully"}


def require_permission(permission: str):
    """
    Factory function to create a dependency that requires a specific permission
    """
    async def permission_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", "candidate_assistant")
        
        if not check_permission(user_role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission} required"
            )
        
        return current_user
    
    return permission_checker