# Auth service

## Endpoints
- Create User - `/register`
- Verify Email registration - `/register/verify`
- Login - `/login`
- Select MFA Method - `/login/select-mfa`
- Verify MFA Login Challenge - `/login/verify`
- Setup Authenticator App - `/mfa/totp/setup`
- Enable Authenticator App - `/mfa/totp/enable`
- Disable Authenticator App - `/mfa/totp/disable`
- Setup Email MFA - `/mfa/email/setup`
- Enable Email MFA - `/mfa/email/enable`
- Disable Email MFA - `/mfa/email/disable`
- Logout - `/logout`
- Get Session Status - `/status`
- Send Forgot Password - `/password-reset/request`
- Reset Password - `/password-reset/verify`
- Change Password - `/password/change`

## TODO
- Name change endpoint
- Option to add an image in user profile
- email changeing endpoints
- Also need a mapping for the friends & users can be able to search someone using the friend's email
- user also can maintain a block list
- To be friend user send a request and other user need to accept the request to make them a friend
- when user is blocked the user cant able to send request or do any action