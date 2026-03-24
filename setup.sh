#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << 'EOF'
   _   _                      _ _         
  / \ | |__ _ _____   ___ _ __( )___  ___ 
 / _ \| / _` (_-< _ \/ -_) '_|// _ \/ __|
/_/ \_\_\__,_/__/\___/\___|_|  \___/\__|
                                             
EOF
echo -e "${NC}"
echo -e "${GREEN}Real-time Mesh Network Visualization${NC}"
echo ""
echo "============================================"
echo ""

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}✗ ${1} not found. Please install ${1}${NC}"
        echo "  See: ${2}"
        return 1
    fi
    echo -e "${GREEN}✓ ${1} found${NC}"
    return 0
}

echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"
echo ""

PREREQ_OK=true

if check_command "docker" "https://docs.docker.com/get-docker/"; then
    docker compose version &> /dev/null || docker-compose --version &> /dev/null || PREREQ_OK=false
fi

if ! $PREREQ_OK; then
    echo -e "${RED}Please install Docker and Docker Compose first.${NC}"
    exit 1
fi

if check_command "curl" "https://curl.se/"; then
    :
fi

echo ""
echo -e "${YELLOW}[2/6] Checking .env configuration...${NC}"
echo ""

if [ ! -f .env ]; then
    echo "No .env file found. Creating from example..."
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo ""
    echo -e "${YELLOW}Please edit .env and add your Cloudflare Tunnel token:${NC}"
    echo -e "  nano .env"
    echo ""
    read -p "Press Enter when you've added your CLOUDFLARE_TUNNEL_TOKEN (or skip for local dev): "
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ] && [ -f .env ]; then
    echo ""
    echo -e "${YELLOW}Note: CLOUDFLARE_TUNNEL_TOKEN is not set.${NC}"
    echo "  - For local development, this is fine"
    echo "  - For production, add your tunnel token to .env"
    echo ""
fi

echo ""
echo -e "${YELLOW}[3/6] Creating directories...${NC}"
echo ""

mkdir -p certs
echo -e "${GREEN}✓ Created certs/ directory${NC}"

mkdir -p data
echo -e "${GREEN}✓ Created data/ directory${NC}"

echo ""
echo -e "${YELLOW}[4/6] Generating SSL certificates...${NC}"
echo ""

if [ -f certs/server.crt ] && [ -f certs/server.key ]; then
    echo -e "${GREEN}✓ SSL certificates already exist${NC}"
else
    echo "Generating self-signed certificates..."
    openssl req -x509 -nodes -newkey rsa:2048 \
        -keyout certs/server.key \
        -out certs/server.crt \
        -days 365 \
        -subj "/CN=northmesh" 2>/dev/null
    echo -e "${GREEN}✓ SSL certificates generated${NC}"
fi

echo ""
echo -e "${YELLOW}[5/6] Building Docker images...${NC}"
echo ""

docker compose build
echo -e "${GREEN}✓ Build complete${NC}"

echo ""
echo -e "${YELLOW}[6/6] Starting services...${NC}"
echo ""

docker compose up -d
echo -e "${GREEN}✓ Services started${NC}"

echo ""
echo "============================================"
echo -e "${GREEN}NorthMesh is starting up!${NC}"
echo "============================================"
echo ""
echo "Services:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:3001"
echo ""
echo "To check status:"
echo "  docker compose ps"
echo "  docker compose logs -f"
echo ""
echo "To stop:"
echo "  docker compose down"
echo ""
echo "============================================"
echo ""

if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo -e "${YELLOW}Cloudflare Tunnel not configured.${NC}"
    echo ""
    echo "To enable Cloudflare Tunnel for https://northmesh.co.uk:"
    echo ""
    echo "1. Go to https://dash.cloudflare.com"
    echo "2. Select your domain"
    echo "3. Go to Networks > Tunnels"
    echo "4. Create a new tunnel (Cloudflared)"
    echo "5. Name it 'northmesh'"
    echo "6. Add hostname: northmesh.co.uk → https://nginx:443"
    echo "7. Copy the tunnel token"
    echo "8. Edit .env and set CLOUDFLARE_TUNNEL_TOKEN=your-token"
    echo "9. Run: docker compose up -d"
    echo ""
fi

sleep 2
echo "Checking service health..."
echo ""

for i in {1..10}; do
    if curl -sf http://localhost:3001/health &> /dev/null; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi
    echo "  Waiting for backend... ($i/10)"
    sleep 1
done

if curl -sf http://localhost:3000 &> /dev/null; then
    echo -e "${GREEN}✓ Frontend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Frontend may still be starting${NC}"
fi

echo ""
echo -e "${BLUE}All done! Visit http://localhost:3000 to see NorthMesh.${NC}"
echo ""
