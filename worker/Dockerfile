FROM python:3.14.3-slim

# ENV (not ARG) is required so DEBIAN_FRONTEND reaches dpkg's subprocess
# during the package configuration phase. It is explicitly unset at the
# end of the same RUN block so it does not persist into the final image.
ENV DEBIAN_FRONTEND=noninteractive
ARG PIP_VERSION=26.0.1

# System deps for psycopg2-binary
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Unset DEBIAN_FRONTEND so it does not persist into the running container
ENV DEBIAN_FRONTEND=

# Create a non-root user so pip (and the worker process) never run as root
RUN adduser --disabled-password --gecos "" --uid 1001 appuser

# Create a dedicated virtualenv and pin pip deterministically.
RUN python -m venv /opt/venv \
    && /opt/venv/bin/python -m pip install --no-cache-dir --upgrade "pip==${PIP_VERSION}"

# Ensure the venv tools are used first
ENV PATH="/opt/venv/bin:/home/appuser/.local/bin:${PATH}"

WORKDIR /app
RUN chown -R appuser:appuser /app /opt/venv

COPY --chown=appuser:appuser requirements.txt .

USER appuser

RUN python -m pip --version \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser . .

# Timezone data so APScheduler can resolve Europe/Athens
ENV TZ=Europe/Athens

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import psycopg2, os; psycopg2.connect(host=os.getenv('POSTGRES_HOST','db'), dbname=os.getenv('POSTGRES_DB','portfolio_db'), user=os.getenv('POSTGRES_USER','portfolio_user'), password=os.getenv('POSTGRES_PASSWORD','portfolio_pass')).close()"

CMD ["python", "-u", "worker.py"]
