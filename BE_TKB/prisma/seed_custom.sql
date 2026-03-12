/* * SCRIPT DATA V5 (COMPLETE) - FIXED CONSTRAINTS & TYPES */

-- 1. CLEANUP
TRUNCATE TABLE timetable_slots, teaching_assignments, classes, teachers, subjects, rooms, semesters, academic_years, teacher_constraints CASCADE;

-- 2. ACADEMIC YEAR (Added start_date, end_date)
INSERT INTO academic_years (name, weeks, status, start_date, end_date) 
VALUES ('2024-2025', 35, 'ACTIVE', '2024-09-05 00:00:00', '2025-05-31 00:00:00');

INSERT INTO semesters (year_id, name, is_current) SELECT id, 'HK1', TRUE FROM academic_years;

-- 3. ROOMS
INSERT INTO rooms (name, type, floor) SELECT generate_series(101, 114)::text, 'CLASSROOM', 1;
INSERT INTO rooms (name, type, floor) SELECT generate_series(201, 214)::text, 'CLASSROOM', 2;
INSERT INTO rooms (name, type, floor) VALUES ('115', 'CLASSROOM', 1), ('215', 'CLASSROOM', 2);
INSERT INTO rooms (name, type, floor) VALUES 
('301', 'LAB_PHYSICS', 3), ('302', 'LAB_CHEM', 3), ('303', 'LAB_BIO', 3),
('314', 'LAB_IT', 3), ('315', 'LAB_IT', 3);

-- 4. SUBJECTS (Added color)
INSERT INTO subjects (code, name, is_special, is_practice, color) VALUES
('CHAO_CO', 'Chào Cờ', TRUE, FALSE, '#FF0000'),
('SH_CUOI_TUAN', 'SH Cuối Tuần', TRUE, FALSE, '#000000'),
('HDTN', 'HĐ Trải Nghiệm', FALSE, FALSE, '#FFD700'), 
('GDDP', 'GD Địa Phương', FALSE, FALSE, '#8A2BE2'),
('TOAN', 'Toán', FALSE, FALSE, '#4682B4'),
('VAN', 'Ngữ Văn', FALSE, FALSE, '#FF69B4'),
('ANH', 'Tiếng Anh', FALSE, FALSE, '#32CD32'),
('LY', 'Vật Lý', FALSE, FALSE, '#FFA500'),
('HOA', 'Hóa Học', FALSE, FALSE, '#00CED1'),
('SINH', 'Sinh Học', FALSE, FALSE, '#98FB98'),
('TIN', 'Tin Học', FALSE, TRUE, '#000080'),
('LS', 'Lịch Sử', FALSE, FALSE, '#8B4513'),
('DIA', 'Địa Lý', FALSE, FALSE, '#D2691E'),
('GDKT', 'GDKT & PL', FALSE, FALSE, '#A52A2A'),
('CN', 'Công Nghệ', FALSE, FALSE, '#708090'),
('GDTC', 'Thể Dục', TRUE, TRUE, '#008080'),
('GDQP', 'Quốc Phòng', TRUE, FALSE, '#2F4F4F');

-- 5. TEACHERS
DO $$ BEGIN
    FOR i IN 1..15 LOOP 
        INSERT INTO teachers (code, full_name, short_name, max_periods_per_week) VALUES 
        ('GV_TOAN_'||i, 'GV Toán '||i, 'Toán '||i, 18),
        ('GV_VAN_'||i, 'GV Văn '||i, 'Văn '||i, 18),
        ('GV_ANH_'||i, 'GV Anh '||i, 'Anh '||i, 18),
        ('GV_LY_'||i, 'GV Lý '||i, 'Lý '||i, 18),
        ('GV_HOA_'||i, 'GV Hóa '||i, 'Hóa '||i, 18),
        ('GV_SINH_'||i, 'GV Sinh '||i, 'Sinh '||i, 18),
        ('GV_SU_'||i, 'GV Sử '||i, 'Sử '||i, 18),
        ('GV_DIA_'||i, 'GV Địa '||i, 'Địa '||i, 18),
        ('GV_GDKT_'||i, 'GV KTPL '||i, 'KTPL '||i, 18),
        ('GV_CN_'||i, 'GV CN '||i, 'CN '||i, 18),
        ('GV_TIN_'||i, 'GV Tin '||i, 'Tin '||i, 18);
    END LOOP;
    FOR i IN 1..6 LOOP 
        INSERT INTO teachers (code, full_name, short_name, max_periods_per_week) VALUES 
        ('GV_HDTN_'||i, 'GV HĐTN '||i, 'HĐTN '||i, 20);
    END LOOP;
    INSERT INTO teachers (code, full_name, short_name, max_periods_per_week) VALUES 
    ('GV_TD_1', 'GV Thể Dục 1', 'TD1', 25), ('GV_TD_2', 'GV Thể Dục 2', 'TD2', 25),
    ('GV_QP_1', 'GV QP 1', 'QP1', 25), ('BGH', 'Ban Giám Hiệu', 'BGH', 0);
END $$;

-- 6. CLASSES
DO $$ 
DECLARE i INT; v_rid INT; v_tid TEXT;
BEGIN
    FOR i IN 1..14 LOOP
        SELECT id INTO v_rid FROM rooms WHERE name = (100+i)::text;
        SELECT id INTO v_tid FROM teachers WHERE code LIKE 'GV_TOAN%' OR code LIKE 'GV_VAN%' OR code LIKE 'GV_ANH%' ORDER BY random() LIMIT 1;
        INSERT INTO classes (name, grade_level, main_session, fixed_room_id, homeroom_teacher_id) VALUES ('12A'||i, 12, 0, v_rid, v_tid);
    
        SELECT id INTO v_rid FROM rooms WHERE name = (100+i)::text;
        SELECT id INTO v_tid FROM teachers WHERE code LIKE 'GV_TOAN%' OR code LIKE 'GV_VAN%' OR code LIKE 'GV_ANH%' ORDER BY random() LIMIT 1;
        INSERT INTO classes (name, grade_level, main_session, fixed_room_id, homeroom_teacher_id) VALUES ('11B'||i, 11, 1, v_rid, v_tid);
        
        SELECT id INTO v_rid FROM rooms WHERE name = (200+i)::text;
        SELECT id INTO v_tid FROM teachers WHERE code LIKE 'GV_TOAN%' OR code LIKE 'GV_VAN%' OR code LIKE 'GV_ANH%' ORDER BY random() LIMIT 1;
        INSERT INTO classes (name, grade_level, main_session, fixed_room_id, homeroom_teacher_id) VALUES ('10C'||i, 10, 0, v_rid, v_tid);
    END LOOP;
END $$;

-- 7. FUNCTION (With Logs)
CREATE OR REPLACE FUNCTION insert_assignment_func(p_class TEXT, p_sub TEXT, p_periods INT, p_type TEXT, p_room TEXT, p_sem_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE v_sid INT; v_tid TEXT;
BEGIN
    SELECT id INTO v_sid FROM subjects WHERE code = p_sub;
    
    IF p_sub IN ('SH_DAU_TUAN', 'SH_CUOI_TUAN') THEN 
        SELECT homeroom_teacher_id INTO v_tid FROM classes WHERE id = p_class;
    ELSIF p_sub = 'HDTN' THEN
            SELECT id INTO v_tid FROM teachers WHERE code LIKE 'GV_HDTN_%' ORDER BY random() LIMIT 1;
    ELSIF p_sub = 'GDDP' THEN
            SELECT id INTO v_tid FROM teachers 
            WHERE code LIKE 'GV_SU_%' OR code LIKE 'GV_DIA_%' OR code LIKE 'GV_GDKT_%'
            ORDER BY random() LIMIT 1;
    ELSIF p_sub = 'CHAO_CO' THEN 
        SELECT id INTO v_tid FROM teachers WHERE code = 'BGH';
    ELSE 
        -- PRIORITY: Check if Homeroom Teacher teaches this subject
        DECLARE v_gvcn_id TEXT; v_gvcn_code TEXT;
        BEGIN
             SELECT homeroom_teacher_id INTO v_gvcn_id FROM classes WHERE id = p_class;
             SELECT code INTO v_gvcn_code FROM teachers WHERE id = v_gvcn_id;
             
             -- Extract subject prefix for teacher code (e.g. TOAN -> GV_TOAN)
             -- Standard format: GV_TOAN_1, GV_VAN_2...
             -- Subject Code mapping: TOAN -> GV_TOAN, VAN -> GV_VAN, etc.
             IF v_gvcn_code LIKE 'GV_'||SUBSTRING(p_sub,1,3)||'%' OR v_gvcn_code LIKE 'GV_'||SUBSTRING(p_sub,1,2)||'%' THEN
                  v_tid := v_gvcn_id;
             END IF;
        END;

        -- Fallback to random if GVCN doesn't match or is null
        IF v_tid IS NULL THEN
            SELECT id INTO v_tid FROM teachers WHERE code LIKE 'GV_'||SUBSTRING(p_sub,1,2)||'%' ORDER BY random() LIMIT 1;
        END IF;

        IF v_tid IS NULL THEN SELECT id INTO v_tid FROM teachers WHERE code LIKE 'GV_%' ORDER BY random() LIMIT 1; END IF;
    END IF;

    IF v_sid IS NULL THEN RAISE NOTICE 'Skipping %: Subject Code not found', p_sub; RETURN; END IF;
    IF v_tid IS NULL THEN RAISE NOTICE 'Skipping %: Teacher not found', p_sub; RETURN; END IF;
    
    INSERT INTO teaching_assignments (semester_id, class_id, teacher_id, subject_id, total_periods, period_type, required_room_type, block_config)
    VALUES (
        p_sem_id, 
        p_class, 
        v_tid, 
        v_sid, 
        p_periods, 
        p_type::public."PeriodType", 
        p_room::public."RoomType", 
        CASE WHEN p_periods>=2 THEN '2' ELSE '1' END
    );
END;
$$;

-- 8. EXECUTE
DO $$
DECLARE 
    v_sem_id TEXT; r_class RECORD;
BEGIN
    SELECT id INTO v_sem_id FROM semesters LIMIT 1;
    RAISE NOTICE 'Using Semester ID: %', v_sem_id;

    IF v_sem_id IS NOT NULL THEN
        FOR r_class IN SELECT * FROM classes LOOP
            -- FIXED
            PERFORM insert_assignment_func(r_class.id, 'CHAO_CO', 1, 'SPECIAL', 'YARD', v_sem_id);
            PERFORM insert_assignment_func(r_class.id, 'SH_DAU_TUAN', 1, 'SPECIAL', 'CLASSROOM', v_sem_id);
            PERFORM insert_assignment_func(r_class.id, 'SH_CUOI_TUAN', 1, 'SPECIAL', 'CLASSROOM', v_sem_id);
            
            -- HĐTN & GDDP
            PERFORM insert_assignment_func(r_class.id, 'HDTN', 2, 'THEORY', NULL, v_sem_id); 
            PERFORM insert_assignment_func(r_class.id, 'GDDP', 1, 'THEORY', NULL, v_sem_id);

            -- COMMON
            PERFORM insert_assignment_func(r_class.id, 'TOAN', 4, 'THEORY', NULL, v_sem_id);
            PERFORM insert_assignment_func(r_class.id, 'VAN', 3, 'THEORY', NULL, v_sem_id);
            PERFORM insert_assignment_func(r_class.id, 'ANH', 3, 'THEORY', NULL, v_sem_id);
            PERFORM insert_assignment_func(r_class.id, 'GDTC', 2, 'SPECIAL', 'YARD', v_sem_id);
            PERFORM insert_assignment_func(r_class.id, 'GDQP', 1, 'SPECIAL', 'YARD', v_sem_id);

            -- ELECTIVES
            DECLARE suffix INT := SUBSTRING(r_class.name FROM '[0-9]+$')::INT;
            BEGIN
                IF suffix <= 4 OR (suffix BETWEEN 6 AND 9) THEN -- KHTN
                    PERFORM insert_assignment_func(r_class.id, 'LY', 3, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'LY', 1, 'PRACTICE', 'LAB_PHYSICS', v_sem_id); 
                    PERFORM insert_assignment_func(r_class.id, 'HOA', 3, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'HOA', 1, 'PRACTICE', 'LAB_CHEM', v_sem_id);   
                    PERFORM insert_assignment_func(r_class.id, 'SINH', 2, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'TIN', 2, 'PRACTICE', 'LAB_IT', v_sem_id);     
                    PERFORM insert_assignment_func(r_class.id, 'LS', 1, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'DIA', 1, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'CN', 1, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'GDKT', 1, 'THEORY', NULL, v_sem_id);
                ELSE -- KHXH
                    PERFORM insert_assignment_func(r_class.id, 'LS', 3, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'DIA', 3, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'GDKT', 3, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'VAN', 1, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'LY', 2, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'HOA', 1, 'THEORY', NULL, v_sem_id); 
                    PERFORM insert_assignment_func(r_class.id, 'SINH', 1, 'THEORY', NULL, v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'TIN', 2, 'PRACTICE', 'LAB_IT', v_sem_id);
                    PERFORM insert_assignment_func(r_class.id, 'CN', 1, 'THEORY', NULL, v_sem_id);
                END IF;
            END;
        END LOOP;
    ELSE
        RAISE NOTICE 'FAILED: No Semester ID found';
    END IF;
END $$;

DROP FUNCTION insert_assignment_func;
