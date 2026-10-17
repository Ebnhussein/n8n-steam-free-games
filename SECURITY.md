# Security

Report a problem privately to the repository maintainer using GitHub's private vulnerability reporting if enabled. Do not put real keys, cookies, passwords, Steam Guard codes, refresh tokens, or full private HTTP responses in issues.

The API key authorizes actions on the Steam account attached to this helper. Keep the service on a private Docker network. The provided Compose file publishes no host ports. Health checks disclose only service availability. Password and Guard input are hidden; only the refresh token is saved with mode 0600. Docker-host administrators can read that volume.

Use one helper instance per account/data volume. Stop it before interactive reauthentication to avoid token rotation races. The helper does not bypass Steam login blocks or purchase paid products. Keep private backups of the volume. `.gitignore` and `.dockerignore` exclude common secret files, but always review changes before committing.

This project uses undocumented Steam Store behavior and the third-party steam-session package. Updates to Steam or dependencies can break compatibility. This is not an official Valve security boundary or an official Steam integration.
