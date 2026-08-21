-- A third level of teacher request: PREFER, a slot the teacher would like to teach.
-- BUSY stays a hard constraint; AVOID and PREFER are weighted wishes.
ALTER TYPE "ConstraintType" ADD VALUE 'PREFER';
