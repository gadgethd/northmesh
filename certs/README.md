# SSL Certificates

This directory is for SSL certificates used in local development and Docker deployment.

## Generating Self-Signed Certificates

For local development with Docker:

```bash
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -days 365 \
  -subj "/CN=northmesh"
```

## Production

For production, use certificates from a trusted CA (Let's Encrypt, Cloudflare Origin SSL, etc.)

## Files

- `server.crt` - SSL certificate
- `server.key` - Private key

Both files are gitignored. Generate fresh ones per deployment.
