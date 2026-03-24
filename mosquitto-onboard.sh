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

if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./mosquitto-onboard.sh <username>${NC}"
    echo ""
    echo "This script adds a new node with write access to the meshcore topic."
    echo "Your firmware will handle publishing to the correct subtopics."
    echo ""
    echo "Example: ./mosquitto-onboard.sh mynode"
    echo ""
    exit 1
fi

USERNAME="$1"
PASSWORD=$(openssl rand -hex 16)

echo -e "${GREEN}Onboarding new node: ${USERNAME}${NC}"
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
    echo -e "${YELLOW}User already exists in ACL, skipping...${NC}"
else
    echo "" >> "$ACL_FILE"
    echo "# New node: $USERNAME" >> "$ACL_FILE"
    echo "user $USERNAME" >> "$ACL_FILE"
    echo "topic write meshcore/#" >> "$ACL_FILE"
fi

echo "Reloading Mosquitto configuration..."
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" kill -s HUP mosquitto

echo ""
echo "============================================"
echo -e "${GREEN}Node onboarded successfully!${NC}"
echo "============================================"
echo ""
echo "Node credentials:"
echo "  Username: ${USERNAME}"
echo "  Password: ${PASSWORD}"
echo ""
echo "MQTT broker: mqtt.northmesh.co.uk:443 (WebSocket)"
echo "Topic: meshcore/# (your firmware handles the rest)"
echo ""
echo -e "${YELLOW}IMPORTANT: Save the password now - it cannot be retrieved!${NC}"
echo ""
