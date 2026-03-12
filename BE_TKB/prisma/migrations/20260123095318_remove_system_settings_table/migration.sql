/*
  Warnings:

  - You are about to drop the `cau_hinh_rang_buoc` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cau_truc_chuong_trinh` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chi_tiet_chuong_trinh` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `danh_muc_nhiem_vu` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dinh_muc_gio_day` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `giao_vien` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `hoc_ky` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kiem_nhiem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lop_hoc` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mon_hoc` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nam_hoc` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `phan_cong_chuyen_mon` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `phan_hoi` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `phong_hoc` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tai_khoan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `thoi_khoa_bieu` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tiet_hoc` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "YearStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('CLASSROOM', 'LAB_PHYSICS', 'LAB_CHEM', 'LAB_BIO', 'LAB_IT', 'YARD', 'MULTI_PURPOSE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "ConstraintType" AS ENUM ('BUSY', 'AVOID');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('THEORY', 'PRACTICE', 'SPECIAL');

-- DropForeignKey
ALTER TABLE "chi_tiet_chuong_trinh" DROP CONSTRAINT "chi_tiet_chuong_trinh_mon_hoc_id_fkey";

-- DropForeignKey
ALTER TABLE "giao_vien" DROP CONSTRAINT "giao_vien_dinh_muc_id_fkey";

-- DropForeignKey
ALTER TABLE "hoc_ky" DROP CONSTRAINT "hoc_ky_nam_hoc_id_fkey";

-- DropForeignKey
ALTER TABLE "kiem_nhiem" DROP CONSTRAINT "kiem_nhiem_giao_vien_id_fkey";

-- DropForeignKey
ALTER TABLE "kiem_nhiem" DROP CONSTRAINT "kiem_nhiem_nam_hoc_id_fkey";

-- DropForeignKey
ALTER TABLE "kiem_nhiem" DROP CONSTRAINT "kiem_nhiem_nhiem_vu_id_fkey";

-- DropForeignKey
ALTER TABLE "lop_hoc" DROP CONSTRAINT "lop_hoc_cau_truc_id_fkey";

-- DropForeignKey
ALTER TABLE "lop_hoc" DROP CONSTRAINT "lop_hoc_giao_vien_cn_id_fkey";

-- DropForeignKey
ALTER TABLE "lop_hoc" DROP CONSTRAINT "lop_hoc_nam_hoc_id_fkey";

-- DropForeignKey
ALTER TABLE "phan_cong_chuyen_mon" DROP CONSTRAINT "phan_cong_chuyen_mon_giao_vien_id_fkey";

-- DropForeignKey
ALTER TABLE "phan_cong_chuyen_mon" DROP CONSTRAINT "phan_cong_chuyen_mon_hoc_ky_id_fkey";

-- DropForeignKey
ALTER TABLE "phan_cong_chuyen_mon" DROP CONSTRAINT "phan_cong_chuyen_mon_lop_hoc_id_fkey";

-- DropForeignKey
ALTER TABLE "phan_cong_chuyen_mon" DROP CONSTRAINT "phan_cong_chuyen_mon_mon_hoc_id_fkey";

-- DropForeignKey
ALTER TABLE "phan_hoi" DROP CONSTRAINT "phan_hoi_giao_vien_id_fkey";

-- DropForeignKey
ALTER TABLE "tai_khoan" DROP CONSTRAINT "tai_khoan_giao_vien_id_fkey";

-- DropForeignKey
ALTER TABLE "thoi_khoa_bieu" DROP CONSTRAINT "thoi_khoa_bieu_hoc_ky_id_fkey";

-- DropForeignKey
ALTER TABLE "tiet_hoc" DROP CONSTRAINT "tiet_hoc_lop_hoc_id_fkey";

-- DropForeignKey
ALTER TABLE "tiet_hoc" DROP CONSTRAINT "tiet_hoc_tkb_id_fkey";

-- DropTable
DROP TABLE "cau_hinh_rang_buoc";

-- DropTable
DROP TABLE "cau_truc_chuong_trinh";

-- DropTable
DROP TABLE "chi_tiet_chuong_trinh";

-- DropTable
DROP TABLE "danh_muc_nhiem_vu";

-- DropTable
DROP TABLE "dinh_muc_gio_day";

-- DropTable
DROP TABLE "giao_vien";

-- DropTable
DROP TABLE "hoc_ky";

-- DropTable
DROP TABLE "kiem_nhiem";

-- DropTable
DROP TABLE "lop_hoc";

-- DropTable
DROP TABLE "mon_hoc";

-- DropTable
DROP TABLE "nam_hoc";

-- DropTable
DROP TABLE "phan_cong_chuyen_mon";

-- DropTable
DROP TABLE "phan_hoi";

-- DropTable
DROP TABLE "phong_hoc";

-- DropTable
DROP TABLE "tai_khoan";

-- DropTable
DROP TABLE "thoi_khoa_bieu";

-- DropTable
DROP TABLE "tiet_hoc";

-- DropEnum
DROP TYPE "BuoiHoc";

-- DropEnum
DROP TYPE "GioiTinh";

-- DropEnum
DROP TYPE "KieuGiamTru";

-- DropEnum
DROP TYPE "LoaiMon";

-- DropEnum
DROP TYPE "LoaiPhong";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "TrangThaiPhanHoi";

-- DropEnum
DROP TYPE "TrangThaiTaiKhoan";

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "weeks" INTEGER NOT NULL DEFAULT 35,
    "status" "YearStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "year_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'CLASSROOM',
    "floor" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 45,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "is_special" BOOLEAN NOT NULL DEFAULT false,
    "is_practice" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TEACHER',
    "teacher_profile_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "short_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "max_periods_per_week" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_constraints" (
    "id" SERIAL NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "session" INTEGER NOT NULL,
    "type" "ConstraintType" NOT NULL,

    CONSTRAINT "teacher_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade_level" INTEGER NOT NULL,
    "main_session" INTEGER NOT NULL,
    "fixed_room_id" INTEGER,
    "homeroom_teacher_id" TEXT,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_assignments" (
    "id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "total_periods" INTEGER NOT NULL,
    "period_type" "PeriodType" NOT NULL DEFAULT 'THEORY',
    "required_room_type" "RoomType",
    "block_config" TEXT,

    CONSTRAINT "teaching_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_timetables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "fitness_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_timetables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "timetable_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "room_id" INTEGER,
    "day" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_teacher_profile_id_key" ON "users"("teacher_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_code_key" ON "teachers"("code");

-- CreateIndex
CREATE INDEX "teacher_constraints_teacher_id_day_of_week_period_idx" ON "teacher_constraints"("teacher_id", "day_of_week", "period");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_timetable_id_class_id_day_period_key" ON "timetable_slots"("timetable_id", "class_id", "day", "period");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_timetable_id_teacher_id_day_period_key" ON "timetable_slots"("timetable_id", "teacher_id", "day", "period");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_timetable_id_room_id_day_period_key" ON "timetable_slots"("timetable_id", "room_id", "day", "period");

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_constraints" ADD CONSTRAINT "teacher_constraints_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_fixed_room_id_fkey" FOREIGN KEY ("fixed_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_homeroom_teacher_id_fkey" FOREIGN KEY ("homeroom_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_timetables" ADD CONSTRAINT "generated_timetables_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "generated_timetables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
