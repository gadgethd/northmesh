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
║   NorthMesh Troubleshooting Guide            ║
╚══════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo ""

check_service() {
    local name=$1
    local port=$2
    echo -n "Checking $name... "
    if curl -sf "http://localhost:$port" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not responding${NC}"
        return 1
    fi
}

echo -e "${YELLOW}[1] Checking Docker Containers${NC}"
echo "============================================"
echo ""
docker compose ps
echo ""

echo -e "${YELLOW}[2] Checking Services${NC}"
echo "============================================"
echo ""
check_service "Frontend" 3000
check_service "Backend" 3001
echo ""

echo -e "${YELLOW}[3] Recent Logs${NC}"
echo "============================================"
echo ""
echo -e "${CYAN}Frontend:${NC}"
docker compose logs --tail=10 frontend 2>&1 | sed 's/^/  /'
echo ""
echo -e "${CYAN}Backend:${NC}"
docker compose logs --tail=10 backend 2>&1 | sed 's/^/  /'
echo ""
echo -e "${CYAN}Cloudflared:${NC}"
docker compose logs --tail=10 cloudflared 2>&1 | sed 's/^/  /'
echo ""

echo -e "${YELLOW}[4] Common Issues${NC}"
echo "============================================"
echo ""

echo -e "${CYAN}MQTT not connecting:${NC}"
echo "  1. Check MQTT_BROKER in .env"
echo "  2. Verify network connectivity to MQTT broker"
echo "  3. Check if MQTT broker requires TLS"
echo "  4. Run: docker compose logs backend | grep MQTT"
echo ""

echo -e "${CYAN}Cloudflare Tunnel not working:${NC}"
echo "  1. Verify CLOUDFLARE_TUNNEL_TOKEN is set"
echo "  2. Check token hasn't expired"
echo "  3. Verify DNS is configured in Cloudflare"
echo "  4. Run: docker compose logs cloudflared"
echo ""

echo -e "${CYAN}Frontend not loading:${NC}"
echo "  1. Check frontend container is running"
echo "  2. Check port 3000 is not blocked"
echo "  3. Run: docker compose logs frontend"
echo ""

echo -e "${CYAN}WebSocket issues:${NC}"
echo "  1. Check nginx is proxying /ws correctly"
echo "  2. Verify VITE_WS_URL matches your host"
echo "  3. Check browser console for errors"
echo ""

echo -e "${YELLOW}[5] Useful Commands${NC}"
echo "============================================"
echo ""
echo "View all logs:         docker compose logs -f"
echo "Restart everything:    docker compose restart"
echo "Rebuild:               docker compose up -d --build"
echo "Stop everything:       docker compose down"
echo "Remove volumes:        docker compose down -v"
echo "Shell into container:  docker compose exec backend sh"
echo ""

echo -e "${YELLOW}[6] Need More Help?${NC}"
echo "============================================"
echo ""
echo "1. Check the README.md for detailed setup instructions"
echo "2. Review SPEC.md for architecture details"
echo "3. Check MQTT broker connectivity"
echo "4. Verify environment variables in .env"
echo ""

read -p "Press Enter to show .env contents (redacted): " 
echo ""
if [ -f .env ]; then
    cat .env | sed 's/CLOUDFLARE_TUNNEL_TOKEN=.*/CLOUDFLARE_TUNNEL_TOKEN=***REDACTED***/' | sed 's/MQTT_PASSWORD=.*/MQTT_PASSWORD=***REDACTED***/'
else
    echo -e "${RED}No .env file found${NC}"
fi
echo ""
