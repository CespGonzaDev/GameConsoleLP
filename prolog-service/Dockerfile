# Multi-stage optimized Dockerfile for GameConsole Prolog AI Microservice
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

# Install SWI-Prolog and curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    swi-prolog \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and Prolog knowledge base
COPY battleship_ai.pl .
COPY solver.py .
COPY main.py .

# Healthcheck validating the service responds ok
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

EXPOSE 5000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
