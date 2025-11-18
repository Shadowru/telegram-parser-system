#!/bin/bash
# scripts/monitor.sh

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check service health
check_service() {
    local service=$1
    local url=$2
    
    if curl -s $url > /dev/null; then
        echo -e "${GREEN}✓ $service is healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ $service is down${NC}"
        return 1
    fi
}

# Function to get container stats
get_container_stats() {
    local container=$1
    
    stats=$(docker stats $container --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}")
    echo "$stats" | tail -n 1
}

clear
echo -e "${BLUE}=== Telegram Parser System Monitor ===${NC}\n"

# Check services
echo -e "${BLUE}Service Health:${NC}"
check_service "Main Server" "http://localhost:3000/health"
check_service "Data Collector" "http://localhost:8000/health"
check_service "Dashboard" "http://localhost/"
check_service "Prometheus" "http://localhost:9090/-/healthy"
check_service "Grafana" "http://localhost:3001/api/health"

# Container stats
echo -e "\n${BLUE}Container Statistics:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Database stats
echo -e "\n${BLUE}Database Statistics:${NC}"
docker-compose exec -T postgres psql -U parser_user -d telegram_parser -c "
SELECT 
    (SELECT COUNT(*) FROM channels) as channels,
    (SELECT COUNT(*) FROM messages) as messages,
    (SELECT COUNT(*) FROM jobs WHERE status = 'pending') as pending_jobs,
    (SELECT COUNT(*) FROM jobs WHERE status = 'running') as running_jobs,
    (SELECT COUNT(*) FROM workers WHERE last_heartbeat > NOW() - INTERVAL '2 minutes') as active_workers;
" -t

# Disk usage
echo -e "\n${BLUE}Disk Usage:${NC}"
df -h | grep -E "Filesystem|/var/lib/docker"

# Recent errors
echo -e "\n${BLUE}Recent Errors (last 10):${NC}"
docker-compose logs --tail=100 | grep -i error | tail -n 10

echo -e "\n${BLUE}Press Ctrl+C to exit${NC}"