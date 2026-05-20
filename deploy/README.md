# TeachEd VPS Deployment

This repository is prepared for a Hetzner VPS deployment with Docker Compose.

## Target Architecture

- Public Nginx on the VPS terminates SSL for `YOUR_DOMAIN`.
- Docker Compose runs:
  - `web`: static TeachEd frontend and reverse proxy for `/api` and `/ws`.
  - `api`: Node/Express backend.
  - `db`: PostgreSQL 16.
- Frontend API calls resolve to the current domain by default, so `/api` and `/ws` stay on the VPS.

## First Server Setup

1. Create an Ubuntu 24.04 VPS.
2. Point a domain, for example `teached.munister.com.ua`, to the server IP.
3. SSH into the server.
4. Clone the repo:

```bash
sudo apt-get update
sudo apt-get install -y git
sudo git clone https://github.com/munister-v/teached.git /opt/teached
cd /opt/teached
```

5. Install Docker, Nginx, Certbot and firewall rules:

```bash
sudo bash deploy/scripts/bootstrap-ubuntu.sh
```

6. Create environment file:

```bash
sudo cp .env.example .env
sudo nano .env
```

Generate secrets:

```bash
openssl rand -hex 32
```

7. Start Docker services:

```bash
sudo bash deploy/scripts/deploy.sh
```

8. Configure host Nginx:

```bash
sudo cp deploy/nginx/host.conf.example /etc/nginx/sites-available/teached
sudo nano /etc/nginx/sites-available/teached
sudo ln -s /etc/nginx/sites-available/teached /etc/nginx/sites-enabled/teached
sudo nginx -t
sudo systemctl reload nginx
```

9. Add HTTPS:

```bash
sudo certbot --nginx -d YOUR_DOMAIN
```

## Updates

```bash
cd /opt/teached
sudo bash deploy/scripts/deploy.sh
```

## Useful Commands

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
docker compose exec db pg_dump -U teached teached > backup.sql
```

## Notes

- Keep `.env` private.
- `PGSSL=false` is correct for the bundled Docker PostgreSQL.
- If the database moves to a managed provider later, set `PGSSL=true` and update `DATABASE_URL`.
