"""
Authentication and Authorization Utilities
Handles JWT tokens, password hashing, and user permissions
"""

from datetime import datetime, timedelta
from typing import Optional
import secrets
import bcrypt
from jose import JWTError, jwt
from passlib.context import CryptContext

# Security Configuration
SECRET_KEY = secrets.token_urlsafe(32)  # Generate a random secret key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8  # Session expires after 8 hours of inactivity

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Stored hashed password
        
    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token
    
    Args:
        data: Dictionary containing user data to encode in token
        expires_delta: Optional expiration time delta
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """
    Verify and decode a JWT token
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token data if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_session_token() -> str:
    """
    Generate a secure random session token
    
    Returns:
        Random session token string
    """
    return secrets.token_urlsafe(32)


# Permission Definitions
PERMISSIONS = {
    'super_admin': {
        'view_all_dun': True,
        'export_all': True,
        'update_voters': True,
        'manage_users': True,
        'generate_reports': True,
        'view_audit_logs': True,
    },
    'candidate': {
        'view_all_dun': False,
        'view_own_dun': True,
        'export_own_dun': True,
        'update_voters': True,
        'manage_users': False,
        'generate_reports': True,
        'view_audit_logs': False,
    },
    'candidate_assistant': {
        'view_all_dun': False,
        'view_own_dun': True,
        'export_own_dun': False,  # Read-only
        'update_voters': False,
        'manage_users': False,
        'generate_reports': True,  # Can view results
        'view_audit_logs': False,
    },
    'super_user': {
        'view_all_dun': False,
        'view_own_dun': True,
        'export_own_dun': True,
        'update_voters': False,
        'manage_users': False,
        'generate_reports': True,
        'view_audit_logs': False,
    },
    'pdm': {
        'view_all_dun': False,
        'view_own_dun': True,
        'export_own_dun': True,
        'update_voters': True,
        'manage_users': False,
        'generate_reports': True,
        'view_audit_logs': False,
    }
}


def check_permission(user_role: str, permission: str) -> bool:
    """
    Check if a user role has a specific permission
    
    Args:
        user_role: User's role (e.g., 'candidate', 'pdm')
        permission: Permission to check (e.g., 'update_voters')
        
    Returns:
        True if user has permission, False otherwise
    """
    if user_role not in PERMISSIONS:
        return False
    
    return PERMISSIONS[user_role].get(permission, False)


def can_access_dun(user_role: str, user_dun: Optional[str], target_dun: str) -> bool:
    """
    Check if user can access data from a specific DUN
    
    Args:
        user_role: User's role
        user_dun: User's assigned DUN
        target_dun: DUN being accessed
        
    Returns:
        True if user can access the DUN, False otherwise
    """
    # Super admin can access all DUNs
    if user_role == 'super_admin':
        return True
    
    # Other users can only access their own DUN
    return user_dun == target_dun


# Script to generate password hashes (for manual user creation)
if __name__ == "__main__":
    print("\n=== Password Hash Generator ===\n")
    
    while True:
        password = input("Enter password to hash (or 'quit' to exit): ")
        
        if password.lower() == 'quit':
            break
        
        if len(password) < 8:
            print("❌ Password must be at least 8 characters long\n")
            continue
        
        hashed = hash_password(password)
        print(f"\n✅ Hashed password:\n{hashed}\n")
        print("Copy this hash to insert into the database\n")
        print("-" * 60 + "\n")