FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libjpeg62-turbo \
        libpng16-16 \
        libwebp7 \
        zlib1g \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies come from the hashed lock file, so every build installs the
# exact versions CI tested. The project itself adds no further packages.
COPY requirements.lock ./
RUN pip install --upgrade pip \
    && pip install --require-hashes -r requirements.lock

COPY pyproject.toml README.md ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

RUN pip install --no-deps .

RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
