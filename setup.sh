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

echo -e "${YELLOW}[1/8] Checking prerequisites...${NC}"
echo ""

PREREQ_OK=true

if check_command "docker" "https://docs.docker.com/get-docker/"; then
    docker compose version &> /dev/null || docker-compose --version &> /dev/null || PREREQ_OK=false
fi

if ! $PREREQ_OK; then
    echo -e "${RED}Please install Docker and Docker Compose first.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}[2/8] Checking .env configuration...${NC}"
echo ""

if [ ! -f .env ]; then
    echo "No .env file found. Creating from example..."
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

echo ""
echo -e "${YELLOW}[3/8] Generating passwords...${NC}"
echo ""

generate_password() {
    openssl rand -hex 16
}

source .env 2>/dev/null || true

if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "change" ]; then
    PASSWORD=$(generate_password)
    if grep -q "^POSTGRES_PASSWORD=" .env 2>/dev/null; then
        sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PASSWORD|" .env
    else
        echo "POSTGRES_PASSWORD=$PASSWORD" >> .env
    fi
    export POSTGRES_PASSWORD=$PASSWORD
    echo -e "${GREEN}✓ Generated POSTGRES_PASSWORD${NC}"
fi

if [ -z "$MQTT_PASSWORD" ]; then
    PASSWORD=$(generate_password)
    if grep -q "^MQTT_PASSWORD=" .env 2>/dev/null; then
        sed -i "s|MQTT_PASSWORD=.*|MQTT_PASSWORD=$PASSWORD|" .env
    else
        echo "MQTT_PASSWORD=$PASSWORD" >> .env
    fi
    export MQTT_PASSWORD=$PASSWORD
    echo -e "${GREEN}✓ Generated MQTT_PASSWORD${NC}"
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change" ]; then
    SECRET=$(openssl rand -hex 64)
    if grep -q "^JWT_SECRET=" .env 2>/dev/null; then
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
    else
        echo "JWT_SECRET=$SECRET" >> .env
    fi
    export JWT_SECRET=$SECRET
    echo -e "${GREEN}✓ Generated JWT_SECRET${NC}"
fi

echo ""
echo -e "${YELLOW}[4/8] Cloudflare Tunnel Setup${NC}"
echo "============================================"
echo ""
echo "If you don't have a tunnel token, create one at:"
echo "  https://dash.cloudflare.com > Networks > Tunnels"
echo ""
read -p "Enter your Cloudflare Tunnel token (or press Enter to skip): " TOKEN

if [ -n "$TOKEN" ]; then
    if grep -q "CLOUDFLARE_TUNNEL_TOKEN=" .env; then
        sed -i "s|CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=$TOKEN|" .env
    else
        echo "CLOUDFLARE_TUNNEL_TOKEN=$TOKEN" >> .env
    fi
    echo -e "${GREEN}✓ Tunnel token saved to .env${NC}"
else
    echo -e "${YELLOW}Skipping tunnel setup${NC}"
fi

echo ""
echo -e "${YELLOW}[5/8] Creating directories...${NC}"
echo ""

mkdir -p mosquitto/log mosquitto/data
echo -e "${GREEN}✓ Created mosquitto directories${NC}"

mkdir -p certs
echo -e "${GREEN}✓ Created certs/ directory${NC}"

mkdir -p data
echo -e "${GREEN}✓ Created data/ directory${NC}"

echo ""
echo -e "${YELLOW}[6/8] Generating SSL certificates...${NC}"
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
echo -e "${YELLOW}[7/8] Building Docker images...${NC}"
echo ""

docker compose build
echo -e "${GREEN}✓ Build complete${NC}"

echo ""
echo -e "${YELLOW}[8/8] Starting services...${NC}"
echo ""

set -a
source .env
docker compose up -d
set +a
echo -e "${GREEN}✓ Services started${NC}"

echo ""
echo "============================================"
echo -e "${GREEN}NorthMesh is starting up!${NC}"
echo "============================================"
echo ""
echo "Services:"
echo "  - Frontend: http://localhost:8080"
echo "  - Backend:  http://localhost:3001"
echo ""
echo "To check status:"
echo "  docker compose ps"
echo "  docker compose logs -f"
echo ""
echo "To stop:"
echo "  docker compose down"
echo ""

if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Cloudflare Tunnel not configured.${NC}"
    echo ""
    echo "To enable HTTPS at northmesh.co.uk:"
    echo "1. Create tunnel at Cloudflare Dashboard"
    echo "2. Add hostname: northmesh.co.uk → http://nginx:8080"
    echo "3. Add hostname: mqtt.northmesh.co.uk → tcp://backend:3001"
    echo "4. Run: nano .env (add CLOUDFLARE_TUNNEL_TOKEN=...)"
    echo "5. Run: docker compose up -d"
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

if curl -sf http://localhost:8080 &> /dev/null; then
    echo -e "${GREEN}✓ Frontend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Frontend may still be starting${NC}"
fi

echo ""
echo -e "${BLUE}All done! Visit http://localhost:8080 to see NorthMesh.${NC}"
echo ""
