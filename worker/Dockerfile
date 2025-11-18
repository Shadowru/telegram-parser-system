# worker/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Create directories
RUN mkdir -p /app/sessions /app/logs && \
    useradd -m -u 1000 worker && \
    chown -R worker:worker /app

USER worker

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import os; exit(0 if os.path.exists('/app/sessions') else 1)"

# Run application
CMD ["python", "src/main.py"]