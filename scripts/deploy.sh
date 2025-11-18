#!/bin/bash
# scripts/deploy.sh

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Telegram Parser Deployment ===${NC}\n"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create .env file from .env.example"
    exit 1
fi

# Load environment variables
source .env

# Backup database
echo -e "${BLUE}Creating database backup...${NC}"
mkdir -p backups
BACKUP_FILE="backups/pre_deploy_$(date +%Y%m%d_%H%M%S).sql"
docker-compose exec -T postgres pg_dump -U parser_user telegram_parser > $BACKUP_FILE
echo -e "${GREEN}Backup created: $BACKUP_FILE${NC}\n"

# Pull latest changes
echo -e "${BLUE}Pulling latest changes...${NC}"
git pull origin main
echo -e "${GREEN}Code updated${NC}\n"

# Build new images
echo -e "${BLUE}Building Docker images...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}Images built${NC}\n"

# Stop services
echo -e "${YELLOW}Stopping services...${NC}"
docker-compose down
echo -e "${GREEN}Services stopped${NC}\n"

# Start services
echo -e "${BLUE}Starting services...${NC}"
docker-compose up -d
echo -e "${GREEN}Services started${NC}\n"

# Wait for services to be ready
echo -e "${BLUE}Waiting for services to be ready...${NC}"
sleep 30

# Health check
echo -e "${BLUE}Running health checks...${NC}"
HEALTH_CHECK_FAILED=0

# Check main server
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✓ Main Server is healthy${NC}"
else
    echo -e "${RED}✗ Main Server health check failed${NC}"
    HEALTH_CHECK_FAILED=1
fi

# Check data collector
if curl -s http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✓ Data Collector is healthy${NC}"
else
    echo -e "${RED}✗ Data Collector health check failed${NC}"
    HEALTH_CHECK_FAILED=1
fi

# Check dashboard
if curl -s http://localhost/ > /dev/null; then
    echo -e "${GREEN}✓ Dashboard is healthy${NC}"
else
    echo -e "${RED}✗ Dashboard health check failed${NC}"
    HEALTH_CHECK_FAILED=1
fi

if [ $HEALTH_CHECK_FAILED -eq 1 ]; then
    echo -e "\n${RED}Deployment failed! Some services are not healthy.${NC}"
    echo -e "${YELLOW}Rolling back...${NC}"
    
    # Restore from backup
    docker-compose exec -T postgres psql -U parser_user -d telegram_parser < $BACKUP_FILE
    
    echo -e "${RED}Deployment rolled back${NC}"
    exit 1
fi

# Clean up old images
echo -e "\n${BLUE}Cleaning up old images...${NC}"
docker image prune -f
echo -e "${GREEN}Cleanup completed${NC}"

echo -e "\n${GREEN}=== Deployment Completed Successfully ===${NC}"
echo -e "Dashboard: http://localhost"
echo -e "API: http://localhost:3000"
echo -e "Grafana: http://localhost:3001"echo -e "Grafana: http://localhost:3001"