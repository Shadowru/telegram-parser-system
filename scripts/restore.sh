#!/bin/bash
# scripts/restore.sh

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Error: Backup file not specified${NC}"
    echo "Usage: ./scripts/restore.sh <backup_file.tar.gz>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}WARNING: This will restore from backup and overwrite current data!${NC}"
read -p "Are you sure? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled"
    exit 1
fi

echo -e "${BLUE}=== Restoring from Backup ===${NC}\n"

# Extract backup
echo -e "${BLUE}Extracting backup...${NC}"
TEMP_DIR=$(mktemp -d)
tar -xzf $BACKUP_FILE -C $TEMP_DIR
BACKUP_DIR=$(find $TEMP_DIR -mindepth 1 -maxdepth 1 -type d)
echo -e "${GREEN}✓ Backup extracted${NC}"

# Stop services
echo -e "${YELLOW}Stopping services...${NC}"
docker-compose down
echo -e "${GREEN}✓ Services stopped${NC}"

# Restore database
echo -e "${BLUE}Restoring database...${NC}"
docker-compose up -d postgres
sleep 10
docker-compose exec -T postgres psql -U parser_user -d telegram_parser < $BACKUP_DIR/database.sql
echo -e "${GREEN}✓ Database restored${NC}"

# Restore Redis
echo -e "${BLUE}Restoring Redis...${NC}"
docker-compose up -d redis
sleep 5
docker cp $BACKUP_DIR/redis.rdb $(docker-compose ps -q redis):/data/dump.rdb
docker-compose restart redis
echo -e "${GREEN}✓ Redis restored${NC}"

# Restore worker sessions
echo -e "${BLUE}Restoring worker sessions...${NC}"
rm -rf worker/sessions
cp -r $BACKUP_DIR/sessions worker/
echo -e "${GREEN}✓ Sessions restored${NC}"

# Restore configuration
echo -e "${BLUE}Restoring configuration...${NC}"
cp $BACKUP_DIR/.env .env
echo -e "${GREEN}✓ Configuration restored${NC}"

# Start all services
echo -e "${BLUE}Starting all services...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Services started${NC}"

# Cleanup
rm -rf $TEMP_DIR

echo -e "\n${GREEN}=== Restore Completed ===${NC}"