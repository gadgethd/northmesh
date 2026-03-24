#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}"
cat << 'EOF'
   _   _                      _ _
  / \ | |__ _ _____   ___ _ __( )___  ___
 / _ \| / _` (_-< _ \/ -_) '_|// _ \/ __|
/_/ \_\_\__,_/__/\___/\___|_|  \___/\__|

EOF
echo -e "${NC}"
echo -e "${GREEN}Mosquitto Node Onboarding${NC}"
echo ""
echo "============================================"
echo ""

if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${YELLOW}Usage: ./mosquitto-onboard.sh <IATA> <public_key>${NC}"
    echo ""
    echo "This script adds a new node with write-only MQTT permissions."
    echo "The node will only be able to publish to:"
    echo "  meshcore/{IATA}/{public_key}/packets"
    echo "  meshcore/{IATA}/{public_key}/status"
    echo ""
    echo "Example: ./mosquitto-onboard.sh LHR abc123def456..."
    echo ""
    exit 1
fi

IATA="$1"
PUBLIC_KEY="$2"
USERNAME="${IATA}_${PUBLIC_KEY}"
PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

echo -e "${GREEN}Onboarding new node: ${IATA}/${PUBLIC_KEY}${NC}"
echo ""

echo "Generating password..."
echo -e "${GREEN}✓ Password: ${PASSWORD}${NC}"
echo ""

echo "Adding user to Mosquitto passwd file..."
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" exec -T mosquitto \
    mosquitto_passwd -b /mosquitto/config/passwd "$USERNAME" "$PASSWORD"

echo "Updating ACL file..."
ACL_FILE="${SCRIPT_DIR}/mosquitto/acl"

if grep -q "^user ${USERNAME}$" "$ACL_FILE" 2>/dev/null; then
    echo -e "${YELLOW}Node already exists in ACL, skipping...${NC}"
else
    echo "" >> "$ACL_FILE"
    echo "# New node: $IATA/$PUBLIC_KEY" >> "$ACL_FILE"
    echo "user $USERNAME" >> "$ACL_FILE"
    echo "topic write meshcore/$IATA/$PUBLIC_KEY/packets" >> "$ACL_FILE"
    echo "topic write meshcore/$IATA/$PUBLIC_KEY/status" >> "$ACL_FILE"
fi

echo "Reloading Mosquitto configuration..."
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" exec -T mosquitto \
    mosquitto_ctrl reload /mosquitto/config/passwd

echo ""
echo "============================================"
echo -e "${GREEN}Node onboarded successfully!${NC}"
echo "============================================"
echo ""
echo "Node credentials:"
echo "  IATA: ${IATA}"
echo "  Public Key: ${PUBLIC_KEY}"
echo "  MQTT Username: ${USERNAME}"
echo "  MQTT Password: ${PASSWORD}"
echo ""
echo "MQTT broker: mqtt.northmesh.co.uk:443 (WebSocket)"
echo "Topics:"
echo "  meshcore/${IATA}/${PUBLIC_KEY}/packets"
echo "  meshcore/${IATA}/${PUBLIC_KEY}/status"
echo ""
echo -e "${YELLOW}IMPORTANT: Save the password now - it cannot be retrieved!${NC}"
echo ""
