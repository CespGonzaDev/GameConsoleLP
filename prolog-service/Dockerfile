# GameConsole Prolog AI Microservice (FastAPI + SWI-Prolog) on :5000
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

# SWI-Prolog engine + curl for the healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    swi-prolog \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source code and Prolog knowledge base
COPY battleship_ai.pl solver.py main.py ./

# Run unprivileged
RUN useradd --system --no-create-home appuser
USER appuser

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fs http://127.0.0.1:5000/health || exit 1

EXPOSE 5000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
