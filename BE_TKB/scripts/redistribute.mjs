import {PrismaClient} from '@prisma/client';

const p = new PrismaClient();

async function main() {
  // 1. Add new teachers directly to DB
  const newTeachers = [
    { code: 'GV073', full_name: 'Nguyễn Văn Hưng', major_subject: 'HDTN', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV074', full_name: 'Trần Thị Hoa', major_subject: 'HDTN', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV075', full_name: 'Lê Minh Đức', major_subject: 'TIN', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV076', full_name: 'Phạm Quốc Tuấn', major_subject: 'TIN', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV077', full_name: 'Đỗ Văn Thắng', major_subject: 'GDTC', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV078', full_name: 'Lê Quốc Khánh', major_subject: 'GDQP', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV079', full_name: 'Ngô Thị Linh', major_subject: 'LS', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV080', full_name: 'Đặng Minh Tuấn', major_subject: 'DIA', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV081', full_name: 'Trần Thị Hạnh', major_subject: 'GDKT', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV082', full_name: 'Phạm Văn Kiên', major_subject: 'SINH', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV083', full_name: 'Hoàng Thị Mai', major_subject: 'CNCN', position: 'GV', max_periods_per_week: 17 },
    { code: 'GV084', full_name: 'Vũ Minh Thành', major_subject: 'MT', position: 'GV', max_periods_per_week: 17 },
  ];

  for (const t of newTeachers) {
    await p.teacher.upsert({
      where: { code: t.code },
      create: { ...t, status: 'Dang_day', teachable_grades: '[10,11,12]' },
      update: { ...t },
    });
    console.log('Upserted:', t.code, t.full_name);
  }

  // 2. Get current semester
  const semester = await p.semester.findFirst({ where: { is_current: true } });
  const semId = semester ? semester.id : '432fc3fa-d53d-488b-991b-8505ba195415';
  console.log('\nUsing semester:', semId);

  // 3. Get all subjects
  const subjects = await p.subject.findMany();
  const subjectMap = new Map();
  subjects.forEach(s => subjectMap.set(s.code, s));

  // 4. Get all classes
  const classes = await p.class.findMany();

  // 5. Get existing assignments
  const existing = await p.teachingAssignment.findMany({ where: { semester_id: semId } });
  console.log('Existing assignments:', existing.length);

  // 6. Analyze overloaded teachers and redistribute
  const teacherLoad = new Map();
  for (const a of existing) {
    if (!teacherLoad.has(a.teacher_id)) teacherLoad.set(a.teacher_id, { total: 0, assignments: [] });
    teacherLoad.get(a.teacher_id).total += a.total_periods;
    teacherLoad.get(a.teacher_id).assignments.push(a);
  }

  const allTeachers = await p.teacher.findMany();
  const teacherById = new Map();
  const teacherByCode = new Map();
  allTeachers.forEach(t => { teacherById.set(t.id, t); teacherByCode.set(t.code, t); });

  // Identify overloaded teachers and redistribute to new ones
  let redistributed = 0;
  
  // For each subject with new teachers, redistribute from overloaded
  const subjectNewTeacherMap = {
    'HDTN': ['GV073', 'GV074'],
    'TIN': ['GV075', 'GV076'],
    'GDTC': ['GV077'],
    'GDQP': ['GV078'],
    'LS': ['GV079'],
    'DIA': ['GV080'],
    'GDKT': ['GV081'],
    'SINH': ['GV082'],
  };

  for (const [subjCode, newCodes] of Object.entries(subjectNewTeacherMap)) {
    const subj = subjectMap.get(subjCode);
    if (!subj) { console.log('Subject not found:', subjCode); continue; }

    // Find all assignments for this subject
    const subjAssigns = existing.filter(a => a.subject_id === subj.id);
    
    // Group by teacher
    const byTeacher = new Map();
    for (const a of subjAssigns) {
      if (!byTeacher.has(a.teacher_id)) byTeacher.set(a.teacher_id, []);
      byTeacher.get(a.teacher_id).push(a);
    }

    // Sort teachers by load (most loaded first)
    const sorted = [...byTeacher.entries()].sort((a, b) => b[1].length - a[1].length);
    
    // Redistribute excess assignments to new teachers
    let newTeacherIdx = 0;
    for (const [teacherId, assigns] of sorted) {
      const teacher = teacherById.get(teacherId);
      const totalLoad = teacherLoad.get(teacherId)?.total || 0;
      
      // If teacher has too many assignments, move some to new teacher
      if (totalLoad > 17 && newTeacherIdx < newCodes.length) {
        const newTeacher = teacherByCode.get(newCodes[newTeacherIdx]);
        if (!newTeacher) continue;
        
        const newTeacherLoad = teacherLoad.get(newTeacher.id)?.total || 0;
        
        // Move half of this teacher's subject assignments to the new teacher
        const toMove = assigns.slice(Math.ceil(assigns.length / 2));
        
        for (const a of toMove) {
          const newLoad = (teacherLoad.get(newTeacher.id)?.total || 0);
          if (newLoad + a.total_periods > 17) break; // Don't overload new teacher
          
          await p.teachingAssignment.update({
            where: { id: a.id },
            data: { teacher_id: newTeacher.id },
          });
          
          // Update load tracking
          teacherLoad.get(teacherId).total -= a.total_periods;
          if (!teacherLoad.has(newTeacher.id)) teacherLoad.set(newTeacher.id, { total: 0, assignments: [] });
          teacherLoad.get(newTeacher.id).total += a.total_periods;
          
          redistributed++;
          console.log(`  Moved ${subjCode}: ${teacher?.code} -> ${newCodes[newTeacherIdx]} (class assignment ${a.id.slice(0,8)})`);
        }
        
        newTeacherIdx++;
      }
    }
  }

  console.log('\nTotal redistributed:', redistributed);
  
  // 7. Final load report
  console.log('\n=== Final Teacher Load ===');
  const finalAssigns = await p.teachingAssignment.findMany({ where: { semester_id: semId }, include: { teacher: true, subject: true } });
  const finalLoad = new Map();
  for (const a of finalAssigns) {
    const key = a.teacher.code;
    if (!finalLoad.has(key)) finalLoad.set(key, { total: 0, subj: a.subject.code });
    finalLoad.get(key).total += a.total_periods;
  }
  const sortedFinal = [...finalLoad.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [code, val] of sortedFinal.slice(0, 20)) {
    const status = val.total > 17 ? '⚠️ OVERLOADED' : '✅';
    console.log(`${code.padEnd(8)} ${String(val.total).padStart(3)} periods/week ${status}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
