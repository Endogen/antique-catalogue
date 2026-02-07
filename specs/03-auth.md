# Authentication & Authorization

## Overview

Email-based authentication with JWT tokens. Users must verify their email before accessing the platform.

## Flows

### 1. Registration

```
User                    API                     Email Service
  │                      │                           │
  │──POST /auth/register─▶│                           │
  │  {email, password}   │                           │
  │                      │──Create user (unverified)─▶│
  │                      │──Generate verify token────▶│
  │                      │                           │
  │                      │──Send verification email──▶│
  │◀─201 {message}───────│                           │
  │                      │                           │
  │◀─────────────────────Email with link─────────────│
  │                      │                           │
  │──GET /auth/verify────▶│                           │
  │  ?token=xxx          │                           │
  │                      │──Mark user verified───────▶│
  │◀─200 {message}───────│                           │
```

**Validation Rules**:
- Email: valid format, max 255 chars
- Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit

**Verification Token**:
- 64-char random hex string
- Expires in 24 hours
- Single use

### 2. Login

```
User                    API
  │                      │
  │──POST /auth/login────▶│
  │  {email, password}   │
  │                      │
  │                      │──Verify credentials──▶
  │                      │──Check is_verified───▶
  │                      │──Generate JWT─────────▶
  │◀─200 {access_token,──│
  │       refresh_token, │
  │       user}          │
```

**JWT Access Token**:
- Expires in 15 minutes
- Contains: user_id, email, issued_at
- Signed with HS256

**JWT Refresh Token**:
- Expires in 7 days
- Used to obtain new access tokens
- Stored in httpOnly cookie (web) or secure storage (mobile)

### 3. Token Refresh

```
POST /auth/refresh
Cookie: refresh_token=xxx

Response:
{
  "access_token": "new_jwt",
  "expires_in": 900
}
```

### 4. Password Reset

```
User                    API                     Email
  │                      │                        │
  │──POST /auth/forgot───▶│                        │
  │  {email}             │                        │
  │                      │──Generate reset token──▶│
  │                      │──Send reset email──────▶│
  │◀─200 {message}───────│                        │
  │                      │                        │
  │◀──────────────────Email with link─────────────│
  │                      │                        │
  │──POST /auth/reset────▶│                        │
  │  {token, password}   │                        │
  │                      │──Update password───────▶│
  │◀─200 {message}───────│                        │
```

**Reset Token**:
- 64-char random hex string
- Expires in 1 hour
- Invalidates all existing sessions

### 5. Logout

```
POST /auth/logout

- Invalidate refresh token
- Clear httpOnly cookie
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/register | No | Create new account |
| GET | /auth/verify | No | Verify email token |
| POST | /auth/login | No | Authenticate |
| POST | /auth/refresh | Refresh Token | Get new access token |
| POST | /auth/logout | Access Token | Invalidate session |
| POST | /auth/forgot | No | Request password reset |
| POST | /auth/reset | No | Reset password with token |
| GET | /auth/me | Access Token | Get current user |
| PATCH | /auth/me | Access Token | Update profile |
| PATCH | /auth/password | Access Token | Change password |

## Security Measures

1. **Password Storage**: bcrypt with cost factor 12
2. **Rate Limiting**: 
   - Login: 5 attempts per 15 minutes per IP
   - Register: 3 accounts per hour per IP
   - Password reset: 3 requests per hour per email
3. **Token Security**:
   - Access tokens in Authorization header
   - Refresh tokens in httpOnly, Secure, SameSite=Strict cookie
4. **CORS**: Configured for frontend origin only
5. **Email Enumeration**: Same response for existing/non-existing emails

## Email Templates

### Verification Email
```
Subject: Verify your Antique Catalogue account

Hello,

Please verify your email address by clicking the link below:

[Verify Email]({frontend_url}/auth/verify?token={token})

This link expires in 24 hours.

If you didn't create an account, please ignore this email.
```

### Password Reset Email
```
Subject: Reset your password

Hello,

You requested to reset your password. Click the link below:

[Reset Password]({frontend_url}/auth/reset?token={token})

This link expires in 1 hour.

If you didn't request this, please ignore this email.
```

## Error Responses

| Code | Error | Description |
|------|-------|-------------|
| 400 | invalid_credentials | Wrong email or password |
| 400 | email_not_verified | Email not yet verified |
| 400 | token_expired | Verification/reset token expired |
| 400 | token_invalid | Token not found or already used |
| 401 | unauthorized | Missing or invalid access token |
| 403 | account_disabled | Account has been deactivated |
| 409 | email_exists | Email already registered |
| 429 | rate_limited | Too many requests |
