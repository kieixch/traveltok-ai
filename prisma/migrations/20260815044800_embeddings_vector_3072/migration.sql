-- Resize the pgvector column to 3072 dims (gemini-embedding-001). Existing
-- rows are 1536d and cannot be cast, so embeddings (a derived cache) are
-- cleared and rebuilt by re-indexing from the API.
DELETE FROM "Embedding";

ALTER TABLE "Embedding" ALTER COLUMN "vector" SET DATA TYPE vector(3072);
