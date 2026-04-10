FROM python:3.14-slim

# System deps for psycopg2-binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Timezone data so APScheduler can resolve Europe/Athens
ENV TZ=Europe/Athens

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import psycopg2, os; psycopg2.connect(host=os.getenv('POSTGRES_HOST','db'), dbname=os.getenv('POSTGRES_DB','portfolio_db'), user=os.getenv('POSTGRES_USER','portfolio_user'), password=os.getenv('POSTGRES_PASSWORD','portfolio_pass')).close()"

CMD ["python", "-u", "worker.py"]
