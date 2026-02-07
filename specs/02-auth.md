# Authentication

## Flows

### Registration
1. User submits email + password
2. Server creates unverified user, generates verification token
3. Verification email sent via SMTP
4. User clicks link to verify email
5. User can now log in

### Login/Logout
- Email + password → JWT access token
- Refresh token in httpOnly cookie
- Logout invalidates session

### Password Reset
1. User requests reset via email
2. Reset token sent via SMTP
3. User submits new password with token

### Account Deletion
- User can delete their account
- Cascades to all collections, items, images

## Endpoints
```
POST /auth/register      # Create account, send verification
POST /auth/verify        # Verify email with token
POST /auth/login         # Get access token
POST /auth/refresh       # Refresh access token
POST /auth/logout        # Invalidate session
POST /auth/forgot        # Request password reset
POST /auth/reset         # Reset password with token
GET  /auth/me            # Get current user
DELETE /auth/me          # Delete account
```

## Security
- Passwords: bcrypt hashed
- Tokens: JWT with expiration
- Rate limiting on auth endpoints
