-- Tai khoan cua toi: anh dai dien cho moi tai khoan, ngay sinh va dia chi cho giao vien.
-- Admin khong co ho so ca nhan nen chi co anh dai dien.
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

ALTER TABLE "teachers" ADD COLUMN "date_of_birth" DATE;
ALTER TABLE "teachers" ADD COLUMN "address" TEXT;
