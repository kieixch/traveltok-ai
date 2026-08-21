# docker/

Docker assets for local development infrastructure.

| Service  | Image                     | Port | Purpose                          |
| -------- | ------------------------- | ---- | -------------------------------- |
| postgres | `pgvector/pgvector:pg16`  | 5432 | PostgreSQL 16 + pgvector         |
| redis    | `redis:7-alpine`          | 6379 | BullMQ queues + cache            |

- The compose file lives at the repository root: `docker-compose.yml`.
- Configuration is injected from the root `.env` file (see `.env.example`).
- Both services use named persistent volumes.
- No production secrets are stored in the compose file.

## Usage

```bash
docker compose up -d
docker compose ps          # wait until both healthchecks show healthy
docker compose down        # stop containers (volumes are kept)
docker compose down -v     # stop containers and delete volumes
```

## pgvector

PostgreSQL runs the `pgvector/pgvector` image so the `vector` extension is
available for semantic search (Phase 9). Enable it per database with:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
