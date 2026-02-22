#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# LOBBI — Production Deployment Script for Digital Ocean
# Usage: chmod +x deploy.sh && ./deploy.sh
# ═══════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║       LOBBI — Production Deployment               ║"
echo "║       Domain: lobbi.in                           ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Step 1: Check prerequisites ──────────────────────────────

echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker not found. Installing...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}Docker installed. You may need to log out and back in.${NC}"
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose not found. Installing plugin...${NC}"
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi

echo -e "${GREEN}Docker $(docker --version | cut -d' ' -f3) ready.${NC}"

# ─── Step 2: Environment configuration ────────────────────────

echo -e "${YELLOW}[2/7] Checking environment configuration...${NC}"

if [ ! -f .env.production ]; then
    echo -e "${YELLOW}Creating .env.production from template...${NC}"
    cp .env.production.example .env.production

    # Generate secure secrets
    JWT_SECRET=$(openssl rand -hex 32)
    CHAT_KEY=$(openssl rand -hex 32)

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/CHANGE_ME_generate_with_openssl_rand_hex_32/$JWT_SECRET/" .env.production
        sed -i '' "s/CHANGE_ME_generate_with_openssl_rand_hex_32/$CHAT_KEY/" .env.production
    else
        sed -i "0,/CHANGE_ME_generate_with_openssl_rand_hex_32/s//$JWT_SECRET/" .env.production
        sed -i "0,/CHANGE_ME_generate_with_openssl_rand_hex_32/s//$CHAT_KEY/" .env.production
    fi

    echo -e "${GREEN}Generated secure JWT_SECRET and CHAT_ENCRYPTION_KEY.${NC}"
    echo -e "${YELLOW}Please edit .env.production to add Razorpay, SMTP, and other API keys.${NC}"
    echo ""
    read -p "Press Enter after editing .env.production (or press Enter to continue with defaults)..."
fi

# Load env vars
export $(grep -v '^#' .env.production | grep -v '^\s*$' | xargs)

DOMAIN=${DOMAIN:-lobbi.in}
EMAIL=${EMAIL:-admin@lobbi.in}

echo -e "${GREEN}Domain: ${DOMAIN}${NC}"

# ─── Step 3: Initial SSL setup ────────────────────────────────

echo -e "${YELLOW}[3/7] Setting up SSL certificates...${NC}"

# Create temporary nginx config for initial cert generation
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    # First, create a temporary nginx config without SSL
    cat > nginx/nginx-init.conf << 'INITCONF'
server {
    listen 80;
    server_name lobbi.in www.lobbi.in;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Lobbi is being set up...';
        add_header Content-Type text/plain;
    }
}
INITCONF

    # Start nginx with temp config for ACME challenge
    echo "Starting temporary nginx for SSL certificate generation..."
    docker compose -f docker-compose.prod.yml run -d --name horizon-nginx-init \
        -p 80:80 \
        -v "$(pwd)/nginx/nginx-init.conf:/etc/nginx/conf.d/default.conf:ro" \
        -v "horizon_certbot_www:/var/www/certbot" \
        nginx:alpine 2>/dev/null || true

    # Wait for nginx to start
    sleep 3

    # Request certificate
    echo "Requesting SSL certificate from Let's Encrypt..."
    docker run --rm \
        -v "horizon_certbot_www:/var/www/certbot" \
        -v "horizon_certbot_certs:/etc/letsencrypt" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "${EMAIL}" \
        --agree-tos \
        --no-eff-email \
        -d "${DOMAIN}" \
        -d "www.${DOMAIN}"

    # Stop temporary nginx
    docker stop horizon-nginx-init 2>/dev/null || true
    docker rm horizon-nginx-init 2>/dev/null || true
    rm -f nginx/nginx-init.conf

    echo -e "${GREEN}SSL certificate obtained successfully!${NC}"
else
    echo -e "${GREEN}SSL certificates already exist.${NC}"
fi

# ─── Step 4: Build containers ─────────────────────────────────

echo -e "${YELLOW}[4/7] Building Docker containers...${NC}"

docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache

echo -e "${GREEN}All containers built successfully.${NC}"

# ─── Step 5: Start services ───────────────────────────────────

echo -e "${YELLOW}[5/7] Starting all services...${NC}"

docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "Waiting for services to start..."
sleep 10

# ─── Step 6: Health checks ────────────────────────────────────

echo -e "${YELLOW}[6/7] Running health checks...${NC}"

# Check MongoDB
if docker compose -f docker-compose.prod.yml exec -T mongodb mongosh --eval "db.adminCommand('ping')" &>/dev/null; then
    echo -e "  ${GREEN}MongoDB: OK${NC}"
else
    echo -e "  ${RED}MongoDB: FAILED${NC}"
fi

# Check Redis
if docker compose -f docker-compose.prod.yml exec -T redis redis-cli ping | grep -q PONG; then
    echo -e "  ${GREEN}Redis: OK${NC}"
else
    echo -e "  ${RED}Redis: FAILED${NC}"
fi

# Check Backend
if curl -sf http://localhost:8000/docs &>/dev/null; then
    echo -e "  ${GREEN}Backend: OK${NC}"
else
    echo -e "  ${YELLOW}Backend: Checking via Docker...${NC}"
    docker compose -f docker-compose.prod.yml logs --tail=20 backend
fi

# Check Frontend
if docker compose -f docker-compose.prod.yml exec -T frontend curl -sf http://localhost:80 &>/dev/null; then
    echo -e "  ${GREEN}Frontend: OK${NC}"
else
    echo -e "  ${YELLOW}Frontend: Checking via Docker...${NC}"
    docker compose -f docker-compose.prod.yml logs --tail=10 frontend
fi

# Check Nginx
if curl -sf http://localhost &>/dev/null || curl -sfk https://localhost &>/dev/null; then
    echo -e "  ${GREEN}Nginx: OK${NC}"
else
    echo -e "  ${YELLOW}Nginx: Checking...${NC}"
    docker compose -f docker-compose.prod.yml logs --tail=10 nginx
fi

# ─── Step 7: Setup SSL auto-renewal cron ──────────────────────

echo -e "${YELLOW}[7/7] Setting up SSL auto-renewal...${NC}"

RENEW_SCRIPT="$(pwd)/scripts/ssl-renew.sh"
chmod +x "$RENEW_SCRIPT"

# Add cron job if not already present
if ! crontab -l 2>/dev/null | grep -q "ssl-renew"; then
    (crontab -l 2>/dev/null; echo "0 0 */60 * * ${RENEW_SCRIPT} >> /var/log/ssl-renew.log 2>&1") | crontab -
    echo -e "${GREEN}SSL auto-renewal cron job added.${NC}"
else
    echo -e "${GREEN}SSL auto-renewal cron job already exists.${NC}"
fi

# ─── Summary ──────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗"
echo -e "║           Deployment Complete!                    ║"
echo -e "╠══════════════════════════════════════════════════╣"
echo -e "║                                                  ║"
echo -e "║  Website:  https://${DOMAIN}                ║"
echo -e "║  API:      https://${DOMAIN}/api            ║"
echo -e "║  API Docs: https://${DOMAIN}/api/docs       ║"
echo -e "║                                                  ║"
echo -e "╠══════════════════════════════════════════════════╣"
echo -e "║  Useful commands:                                ║"
echo -e "║                                                  ║"
echo -e "║  View logs:                                      ║"
echo -e "║    docker compose -f docker-compose.prod.yml \\   ║"
echo -e "║      logs -f backend                             ║"
echo -e "║                                                  ║"
echo -e "║  Restart:                                        ║"
echo -e "║    docker compose -f docker-compose.prod.yml \\   ║"
echo -e "║      restart                                     ║"
echo -e "║                                                  ║"
echo -e "║  Stop:                                           ║"
echo -e "║    docker compose -f docker-compose.prod.yml \\   ║"
echo -e "║      down                                        ║"
echo -e "║                                                  ║"
echo -e "║  Update (after git pull):                        ║"
echo -e "║    docker compose -f docker-compose.prod.yml \\   ║"
echo -e "║      up -d --build                               ║"
echo -e "║                                                  ║"
echo -e "╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Make sure your DNS A records point to this server's IP:${NC}"
echo -e "  ${DOMAIN}     → $(curl -sf ifconfig.me || echo '<server-ip>')"
echo -e "  www.${DOMAIN} → $(curl -sf ifconfig.me || echo '<server-ip>')"
