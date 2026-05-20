from pydantic import BaseModel, Field

from app.schemas.user import UserResponse


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"


class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class AccountDelete(BaseModel):
    password: str = Field(..., min_length=1)
