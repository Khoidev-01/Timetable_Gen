-- CreateEnum
CREATE TYPE "LoaiPhong" AS ENUM ('PHONG_THUONG', 'PHONG_THUC_HANH_LY', 'PHONG_THUC_HANH_HOA', 'PHONG_THUC_HANH_SINH', 'PHONG_TIN_HOC', 'SAN_BAI_TAP', 'PHONG_CHUC_NANG_KHAC');

-- CreateEnum
CREATE TYPE "LoaiMon" AS ENUM ('BAT_BUOC', 'LUA_CHON', 'CHUYEN_DE_HOC_TAP', 'HOAT_DONG_GIAO_DUC');

-- CreateTable
CREATE TABLE "nam_hoc" (
    "id" TEXT NOT NULL,
    "ten_nam_hoc" TEXT NOT NULL,
    "ngay_bat_dau" TIMESTAMP(3) NOT NULL,
    "ngay_ket_thuc" TIMESTAMP(3) NOT NULL,
    "so_tuan_hoc" INTEGER NOT NULL DEFAULT 35,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nam_hoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hoc_ky" (
    "id" TEXT NOT NULL,
    "ten_hoc_ky" TEXT NOT NULL,
    "nam_hoc_id" TEXT NOT NULL,

    CONSTRAINT "hoc_ky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phong_hoc" (
    "id" TEXT NOT NULL,
    "ten_phong" TEXT NOT NULL,
    "loai_phong" "LoaiPhong" NOT NULL DEFAULT 'PHONG_THUONG',
    "suc_chua" INTEGER NOT NULL DEFAULT 45,
    "trang_thai" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "phong_hoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_hoc" (
    "id" TEXT NOT NULL,
    "ma_mon" TEXT NOT NULL,
    "ten_mon" TEXT NOT NULL,
    "loai_mon" "LoaiMon" NOT NULL,
    "so_tiet_tieu_chuan" INTEGER NOT NULL,
    "yeu_cau_phong" "LoaiPhong",

    CONSTRAINT "mon_hoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giao_vien" (
    "id" TEXT NOT NULL,
    "ma_giao_vien" TEXT NOT NULL,
    "ho_ten" TEXT NOT NULL,
    "email" TEXT,
    "so_dien_thoai" TEXT,
    "so_tiet_toi_da_tuan" INTEGER NOT NULL DEFAULT 20,
    "so_tiet_toi_da_ngay" INTEGER NOT NULL DEFAULT 5,
    "ngay_nghi_dang_ky" JSONB,

    CONSTRAINT "giao_vien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cau_truc_chuong_trinh" (
    "id" TEXT NOT NULL,
    "ten_mo_hinh" TEXT NOT NULL,
    "mo_ta" TEXT,
    "cau_truc_json" JSONB NOT NULL,

    CONSTRAINT "cau_truc_chuong_trinh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chi_tiet_chuong_trinh" (
    "id" TEXT NOT NULL,
    "cau_truc_id" TEXT NOT NULL,
    "mon_hoc_id" TEXT NOT NULL,
    "loai_nhom" TEXT NOT NULL,

    CONSTRAINT "chi_tiet_chuong_trinh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lop_hoc" (
    "id" TEXT NOT NULL,
    "ma_lop" TEXT NOT NULL,
    "ten_lop" TEXT NOT NULL,
    "khoi" INTEGER NOT NULL,
    "nam_hoc_id" TEXT NOT NULL,
    "giao_vien_cn_id" TEXT,
    "cau_truc_id" TEXT NOT NULL,

    CONSTRAINT "lop_hoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phan_cong_chuyen_mon" (
    "id" TEXT NOT NULL,
    "giao_vien_id" TEXT NOT NULL,
    "mon_hoc_id" TEXT NOT NULL,
    "lop_hoc_id" TEXT NOT NULL,
    "so_tiet_tuan" INTEGER NOT NULL DEFAULT 2,
    "so_tiet_lien_tiep" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "phan_cong_chuyen_mon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thoi_khoa_bieu" (
    "id" TEXT NOT NULL,
    "hoc_ky_id" TEXT NOT NULL,
    "ten_phien_ban" TEXT NOT NULL,
    "mo_ta" TEXT,
    "is_chinh_thuc" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thoi_khoa_bieu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiet_hoc" (
    "id" TEXT NOT NULL,
    "tkb_id" TEXT NOT NULL,
    "lop_hoc_id" TEXT NOT NULL,
    "mon_hoc_id" TEXT NOT NULL,
    "giao_vien_id" TEXT,
    "phong_hoc_id" TEXT,
    "thu" INTEGER NOT NULL,
    "buoi" INTEGER NOT NULL,
    "tiet" INTEGER NOT NULL,

    CONSTRAINT "tiet_hoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cau_hinh_rang_buoc" (
    "id" TEXT NOT NULL,
    "ma_rang_buoc" TEXT NOT NULL,
    "ten_rang_buoc" TEXT NOT NULL,
    "loai" TEXT NOT NULL,
    "trong_so" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "mo_ta" TEXT,

    CONSTRAINT "cau_hinh_rang_buoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mon_hoc_ma_mon_key" ON "mon_hoc"("ma_mon");

-- CreateIndex
CREATE UNIQUE INDEX "giao_vien_ma_giao_vien_key" ON "giao_vien"("ma_giao_vien");

-- CreateIndex
CREATE UNIQUE INDEX "lop_hoc_ma_lop_key" ON "lop_hoc"("ma_lop");

-- CreateIndex
CREATE INDEX "tiet_hoc_tkb_id_lop_hoc_id_thu_buoi_tiet_idx" ON "tiet_hoc"("tkb_id", "lop_hoc_id", "thu", "buoi", "tiet");

-- CreateIndex
CREATE UNIQUE INDEX "cau_hinh_rang_buoc_ma_rang_buoc_key" ON "cau_hinh_rang_buoc"("ma_rang_buoc");

-- AddForeignKey
ALTER TABLE "hoc_ky" ADD CONSTRAINT "hoc_ky_nam_hoc_id_fkey" FOREIGN KEY ("nam_hoc_id") REFERENCES "nam_hoc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_chuong_trinh" ADD CONSTRAINT "chi_tiet_chuong_trinh_mon_hoc_id_fkey" FOREIGN KEY ("mon_hoc_id") REFERENCES "mon_hoc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lop_hoc" ADD CONSTRAINT "lop_hoc_nam_hoc_id_fkey" FOREIGN KEY ("nam_hoc_id") REFERENCES "nam_hoc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lop_hoc" ADD CONSTRAINT "lop_hoc_giao_vien_cn_id_fkey" FOREIGN KEY ("giao_vien_cn_id") REFERENCES "giao_vien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lop_hoc" ADD CONSTRAINT "lop_hoc_cau_truc_id_fkey" FOREIGN KEY ("cau_truc_id") REFERENCES "cau_truc_chuong_trinh"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phan_cong_chuyen_mon" ADD CONSTRAINT "phan_cong_chuyen_mon_giao_vien_id_fkey" FOREIGN KEY ("giao_vien_id") REFERENCES "giao_vien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phan_cong_chuyen_mon" ADD CONSTRAINT "phan_cong_chuyen_mon_mon_hoc_id_fkey" FOREIGN KEY ("mon_hoc_id") REFERENCES "mon_hoc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phan_cong_chuyen_mon" ADD CONSTRAINT "phan_cong_chuyen_mon_lop_hoc_id_fkey" FOREIGN KEY ("lop_hoc_id") REFERENCES "lop_hoc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thoi_khoa_bieu" ADD CONSTRAINT "thoi_khoa_bieu_hoc_ky_id_fkey" FOREIGN KEY ("hoc_ky_id") REFERENCES "hoc_ky"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiet_hoc" ADD CONSTRAINT "tiet_hoc_tkb_id_fkey" FOREIGN KEY ("tkb_id") REFERENCES "thoi_khoa_bieu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiet_hoc" ADD CONSTRAINT "tiet_hoc_lop_hoc_id_fkey" FOREIGN KEY ("lop_hoc_id") REFERENCES "lop_hoc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
