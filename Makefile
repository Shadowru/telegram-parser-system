# Makefile
.PHONY: help build up down restart logs clean test migrate seed backup restore

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Telegram Parser - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

# Docker commands
build: ## Build all Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker-compose build

up: ## Start all services
	@echo "$(BLUE)Starting services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Services started successfully!$(NC)"
	@echo "Dashboard: http://localhost"
	@echo "API: http://localhost:3000"
	@echo "Grafana: http://localhost:3001"

down: ## Stop all services
	@echo "$(YELLOW)Stopping services...$(NC)"
	docker-compose down
	@echo "$(GREEN)Services stopped$(NC)"

restart: down up ## Restart all services

logs: ## Show logs from all services
	docker-compose logs -f

logs-api: ## Show logs from main server
	docker-compose logs -f main-server

logs-collector: ## Show logs from data collector
	docker-compose logs -f data-collector

logs-worker: ## Show logs from workers
	docker-compose logs -f worker-1 worker-2

ps: ## Show running containers
	docker-compose ps

# Database commands
db-migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	docker-compose exec postgres psql -U parser_user -d telegram_parser -f /docker-entrypoint-initdb.d/init.sql
	@echo "$(GREEN)Migrations completed$(NC)"

db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U parser_user -d telegram_parser

db-backup: ## Backup database
	@echo "$(BLUE)Creating database backup...$(NC)"
	@mkdir -p backups
	docker-compose exec -T postgres pg_dump -U parser_user telegram_parser > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup created in backups/$(NC)"

db-restore: ## Restore database from backup (usage: make db-restore FILE=backup.sql)
	@echo "$(YELLOW)Restoring database from $(FILE)...$(NC)"
	docker-compose exec -T postgres psql -U parser_user -d telegram_parser < $(FILE)
	@echo "$(GREEN)Database restored$(NC)"

db-reset: ## Reset database (WARNING: deletes all data)
	@echo "$(RED)WARNING: This will delete all data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose exec postgres psql -U parser_user -d telegram_parser -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"; \
		$(MAKE) db-migrate; \
		echo "$(GREEN)Database reset completed$(NC)"; \
	fi

# Redis commands
redis-cli: ## Open Redis CLI
	docker-compose exec redis redis-cli -a $$(grep REDIS_PASSWORD .env | cut -d '=' -f2)

redis-flush: ## Flush Redis cache
	@echo "$(YELLOW)Flushing Redis cache...$(NC)"
	docker-compose exec redis redis-cli -a $$(grep REDIS_PASSWORD .env | cut -d '=' -f2) FLUSHALL
	@echo "$(GREEN)Cache flushed$(NC)"

# Development commands
dev-api: ## Start API in development mode
	cd main-server && npm run dev

dev-dashboard: ## Start dashboard in development mode
	cd dashboard && npm start

install: ## Install dependencies for all services
	@echo "$(BLUE)Installing dependencies...$(NC)"
	cd main-server && npm install
	cd data-collector && pip install -r requirements.txt
	cd worker && pip install -r requirements.txt
	cd dashboard && npm install
	@echo "$(GREEN)Dependencies installed$(NC)"

test: ## Run tests
	@echo "$(BLUE)Running tests...$(NC)"
	cd main-server && npm test
	cd data-collector && pytest
	cd worker && pytest
	@echo "$(GREEN)Tests completed$(NC)"

lint: ## Run linters
	@echo "$(BLUE)Running linters...$(NC)"
	cd main-server && npm run lint
	cd dashboard && npm run lint
	@echo "$(GREEN)Linting completed$(NC)"

format: ## Format code
	@echo "$(BLUE)Formatting code...$(NC)"
	cd main-server && npm run format
	cd dashboard && npm run format
	@echo "$(GREEN)Formatting completed$(NC)"

# Monitoring commands
metrics: ## Show Prometheus metrics
	@echo "$(BLUE)Opening Prometheus...$(NC)"
	open http://localhost:9090

grafana: ## Open Grafana dashboard
	@echo "$(BLUE)Opening Grafana...$(NC)"
	open http://localhost:3001

# Cleanup commands
clean: ## Remove all containers, volumes, and images
	@echo "$(RED)Removing all containers, volumes, and images...$(NC)"
	docker-compose down -v --rmi all
	@echo "$(GREEN)Cleanup completed$(NC)"

clean-logs: ## Remove log files
	@echo "$(YELLOW)Removing log files...$(NC)"
	rm -rf main-server/logs/*
	rm -rf data-collector/logs/*
	rm -rf worker/logs/*
	@echo "$(GREEN)Logs cleaned$(NC)"

# Production commands
prod-deploy: ## Deploy to production
	@echo "$(BLUE)Deploying to production...$(NC)"
	./scripts/deploy.sh
	@echo "$(GREEN)Deployment completed$(NC)"

prod-backup: ## Create production backup
	@echo "$(BLUE)Creating production backup...$(NC)"
	./scripts/backup.sh
	@echo "$(GREEN)Backup completed$(NC)"

# Health checks
health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo "Main Server:"
	@curl -s http://localhost:3000/health | jq . || echo "$(RED)Main Server is down$(NC)"
	@echo "\nData Collector:"
	@curl -s http://localhost:8000/health | jq . || echo "$(RED)Data Collector is down$(NC)"
	@echo "\nDashboard:"
	@curl -s http://localhost/ > /dev/null && echo "$(GREEN)Dashboard is up$(NC)" || echo "$(RED)Dashboard is down$(NC)"

# Worker management
scale-workers: ## Scale workers (usage: make scale-workers N=5)
	@echo "$(BLUE)Scaling workers to $(N)...$(NC)"
	docker-compose up -d --scale worker=$(N)
	@echo "$(GREEN)Workers scaled$(NC)"

# Setup commands
setup: ## Initial setup (create .env, build, migrate)
	@echo "$(BLUE)Running initial setup...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(YELLOW)Created .env file. Please update it with your settings.$(NC)"; \
		exit 1; \
	fi
	$(MAKE) build
	$(MAKE) up
	sleep 10
	$(MAKE) db-migrate
	@echo "$(GREEN)Setup completed!$(NC)"
	@echo "$(YELLOW)Don't forget to create a user account!$(NC)"

# User management
create-user: ## Create admin user
	@echo "$(BLUE)Creating admin user...$(NC)"
	docker-compose exec main-server node -e "require('./dist/scripts/create-user.js')"