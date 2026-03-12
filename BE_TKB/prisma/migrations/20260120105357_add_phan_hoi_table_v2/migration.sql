-- CreateEnum
CREATE TYPE "TrangThaiPhanHoi" AS ENUM ('MOI', 'DA_XEM', 'DA_XU_LY');

-- CreateTable
CREATE TABLE "phan_hoi" (
    "id" TEXT NOT NULL,
    "giao_vien_id" TEXT NOT NULL,
    "tieu_de" TEXT NOT NULL,
    "noi_dung" TEXT NOT NULL,
    "trang_thai" "TrangThaiPhanHoi" NOT NULL DEFAULT 'MOI',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phan_hoi_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "phan_hoi" ADD CONSTRAINT "phan_hoi_giao_vien_id_fkey" FOREIGN KEY ("giao_vien_id") REFERENCES "giao_vien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
