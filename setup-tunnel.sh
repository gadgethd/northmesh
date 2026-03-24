#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
cat << 'EOF'
╔══════════════════════════════════════════════╗
║   Cloudflare Tunnel Setup for NorthMesh      ║
║   Step-by-Step Guide                         ║
╚══════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo ""

echo -e "${YELLOW}This script will help you set up Cloudflare Tunnel${NC}"
echo "to expose NorthMesh at https://northmesh.co.uk"
echo ""
echo "============================================"
echo ""

read -p "Press Enter to continue... "
echo ""

echo -e "${YELLOW}Step 1: Create Cloudflare Tunnel${NC}"
echo "============================================"
echo ""
echo "1. Go to: https://dash.cloudflare.com"
echo "2. Select your domain (or add northmesh.co.uk)"
echo "3. Click: Networks > Tunnels"
echo "4. Click: Create a tunnel"
echo "5. Select: Cloudflared (Gateway)"
echo "6. Click: Save protector"
echo ""
read -p "Press Enter when you see the tunnel token... "
echo ""

echo -e "${YELLOW}Step 2: Name Your Tunnel${NC}"
echo "============================================"
echo ""
echo "When prompted for a tunnel name, enter:"
echo -e "  ${GREEN}northmesh${NC}"
echo ""
read -p "Press Enter to continue... "
echo ""

echo -e "${YELLOW}Step 3: Get Your Tunnel Token${NC}"
echo "============================================"
echo ""
echo "In the tunnel configuration page, look for:"
echo "  'Token:' or 'your tunnel token'"
echo ""
echo "The token looks like:"
echo -e "  ${CYAN}eyJhIjoiNjc3...${NC}"
echo ""
echo -e "${GREEN}Copy your tunnel token${NC}"
echo ""
read -p "Paste your tunnel token here: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
    echo -e "${RED}No token entered. Skipping tunnel configuration.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Step 4: Configure DNS (Cloudflare should prompt you)${NC}"
echo "============================================"
echo ""
echo "Cloudflare may prompt you to add DNS records. Configure:"
echo ""
echo "  Type:    CNAME"
echo "  Name:    northmesh"
echo "  Target:  <tunnel-id>.cfargotunnel.com"
echo ""
echo -e "${GREEN}This routes northmesh.co.uk to your tunnel${NC}"
echo ""
read -p "Press Enter when DNS is configured (or skip): "
echo ""

echo -e "${YELLOW}Step 5: Save Token to .env${NC}"
echo "============================================"
echo ""

if [ ! -f .env ]; then
    cp .env.example .env
fi

if grep -q "CLOUDFLARE_TUNNEL_TOKEN=" .env; then
    sed -i "s|CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=$TOKEN|" .env
else
    echo "CLOUDFLARE_TUNNEL_TOKEN=$TOKEN" >> .env
fi

echo -e "${GREEN}✓ Token saved to .env${NC}"
echo ""

echo -e "${YELLOW}Step 6: Restart Services${NC}"
echo "============================================"
echo ""

docker compose down
docker compose up -d

echo ""
echo -e "${GREEN}✓ Cloudflare Tunnel configured!${NC}"
echo ""
echo "============================================"
echo ""
echo -e "${CYAN}Tunnel Status Check:${NC}"
echo ""
docker compose logs cloudflared 2>&1 | tail -20
echo ""
echo "============================================"
echo ""
echo -e "${GREEN}Your site should now be live at:${NC}"
echo -e "  ${BLUE}https://northmesh.co.uk${NC}"
echo ""
echo "Note: It may take a few minutes for DNS to propagate."
echo ""
