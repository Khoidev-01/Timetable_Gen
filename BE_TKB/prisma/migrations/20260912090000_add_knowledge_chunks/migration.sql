-- Tra cuu quy dinh khong phu thuoc dau tieng Viet.
--
-- unaccent bo dau, pg_trgm cho phep khop gan dung — nguoi dung go "dinh muc tiet day" hay
-- "định mức tiết dạy" deu phai ra cung mot dieu khoan. Khong co hai extension nay thi phai
-- tu viet bang doi ky tu trong ma nguon, va bang do se lech voi cach PostgreSQL sap xep.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "article" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "search_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks"("source");

-- Chi muc trigram tren chinh cot da bo dau: tra cuu gan dung tren bang vai tram dong van
-- nhanh, nhung chi muc nay la thu giu cho no nhanh khi kho tai lieu lon len.
CREATE INDEX "knowledge_chunks_search_trgm_idx" ON "knowledge_chunks" USING GIN ("search_text" gin_trgm_ops);
