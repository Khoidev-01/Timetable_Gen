-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "TrangThaiTaiKhoan" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "GioiTinh" AS ENUM ('NAM', 'NU', 'KHAC');

-- CreateEnum
CREATE TYPE "BuoiHoc" AS ENUM ('SANG', 'CHIEU', 'CA_HAI');

-- AlterTable
ALTER TABLE "giao_vien" ADD COLUMN     "chuc_vu" TEXT,
ADD COLUMN     "gioi_tinh" "GioiTinh",
ADD COLUMN     "he_dao_tao" TEXT,
ADD COLUMN     "ngay_sinh" TIMESTAMP(3),
ADD COLUMN     "so_tiet_nghia_vu" INTEGER NOT NULL DEFAULT 17;

-- AlterTable
ALTER TABLE "lop_hoc" ADD COLUMN     "buoi_hoc" "BuoiHoc" NOT NULL DEFAULT 'SANG';

-- AlterTable
ALTER TABLE "mon_hoc" ADD COLUMN     "mau_sac" TEXT;

-- AlterTable
ALTER TABLE "phan_cong_chuyen_mon" ADD COLUMN     "hoc_ky_id" TEXT;

-- AlterTable
ALTER TABLE "tiet_hoc" ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tai_khoan" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TEACHER',
    "trang_thai" "TrangThaiTaiKhoan" NOT NULL DEFAULT 'ACTIVE',
    "avatar" TEXT,
    "giao_vien_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tai_khoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiem_nhiem" (
    "id" TEXT NOT NULL,
    "ten_nhiem_vu" TEXT NOT NULL,
    "so_tiet_quy_doi" INTEGER NOT NULL DEFAULT 0,
    "giao_vien_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kiem_nhiem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tai_khoan_username_key" ON "tai_khoan"("username");

-- CreateIndex
CREATE UNIQUE INDEX "tai_khoan_giao_vien_id_key" ON "tai_khoan"("giao_vien_id");

-- AddForeignKey
ALTER TABLE "tai_khoan" ADD CONSTRAINT "tai_khoan_giao_vien_id_fkey" FOREIGN KEY ("giao_vien_id") REFERENCES "giao_vien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiem_nhiem" ADD CONSTRAINT "kiem_nhiem_giao_vien_id_fkey" FOREIGN KEY ("giao_vien_id") REFERENCES "giao_vien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phan_cong_chuyen_mon" ADD CONSTRAINT "phan_cong_chuyen_mon_hoc_ky_id_fkey" FOREIGN KEY ("hoc_ky_id") REFERENCES "hoc_ky"("id") ON DELETE SET NULL ON UPDATE CASCADE;
