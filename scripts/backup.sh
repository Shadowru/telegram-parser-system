#!/bin/bash
# scripts/backup.sh

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${BLUE}=== Creating Backup ===${NC}\n"

# Create backup directory
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup database
echo -e "${BLUE}Backing up database...${NC}"
docker-compose exec -T postgres pg_dump -U parser_user telegram_parser > $BACKUP_DIR/database.sql
echo -e "${GREEN}✓ Database backed up${NC}"

# Backup Redis
echo -e "${BLUE}Backing up Redis...${NC}"
docker-compose exec -T redis redis-cli -a $(grep REDIS_PASSWORD .env | cut -d '=' -f2) --rdb $BACKUP_DIR/redis.rdb BGSAVE
echo -e "${GREEN}✓ Redis backed up${NC}"

# Backup worker sessions
echo -e "${BLUE}Backing up worker sessions...${NC}"
cp -r worker/sessions $BACKUP_DIR/
echo -e "${GREEN}✓ Sessions backed up${NC}"

# Backup configuration
echo -e "${BLUE}Backing up configuration...${NC}"
cp .env $BACKUP_DIR/
cp docker-compose.yml $BACKUP_DIR/
echo -e "${GREEN}✓ Configuration backed up${NC}"

# Create archive
echo -e "${BLUE}Creating archive...${NC}"
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR
echo -e "${GREEN}✓ Archive created: $BACKUP_DIR.tar.gz${NC}"

# Upload to S3 (optional)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    echo -e "${BLUE}Uploading to S3...${NC}"
    aws s3 cp $BACKUP_DIR.tar.gz s3://$AWS_S3_BUCKET/backups/
    echo -e "${GREEN}✓ Uploaded to S3${NC}"
fi

# Clean old backups (keep last 7 days)
echo -e "${BLUE}Cleaning old backups...${NC}"
find backups/ -name "*.tar.gz" -mtime +7 -delete
echo -e "${GREEN}✓ Old backups cleaned${NC}"

echo -e "\n${GREEN}=== Backup Completed ===${NC}"
echo -e "Backup file: $BACKUP_DIR.tar.gz"