import {PrismaClient} from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const semId = '432fc3fa-d53d-488b-991b-8505ba195415';
  
  const allTeachers = await p.teacher.findMany();
  const teacherById = new Map();
  allTeachers.forEach(t => teacherById.set(t.id, t));
  
  const subjects = await p.subject.findMany();
  const subjectMap = new Map();
  subjects.forEach(s => subjectMap.set(s.code, s));
  
  const assigns = await p.teachingAssignment.findMany({ 
    where: { semester_id: semId },
    include: { teacher: true, subject: true, class: true }
  });

  // Group assignments by subject
  const bySubject = new Map();
  for (const a of assigns) {
    const code = a.subject.code;
    if (!bySubject.has(code)) bySubject.set(code, []);
    bySubject.get(code).push(a);
  }

  // For each subject, find ALL eligible teachers and redistribute evenly
  for (const [subjCode, subjAssigns] of bySubject) {
    // Find all teachers who have this major_subject
    const eligibleTeachers = allTeachers.filter(t => t.major_subject === subjCode);
    if (eligibleTeachers.length <= 1) continue; // Skip if only 1 teacher
    
    const totalPeriods = subjAssigns.reduce((s, a) => s + a.total_periods, 0);
    const maxPerTeacher = Math.ceil(totalPeriods / eligibleTeachers.length);
    
    // Check if any teacher is overloaded (> maxPerTeacher+2 or > 20)
    const currentLoads = new Map();
    for (const a of subjAssigns) {
      currentLoads.set(a.teacher_id, (currentLoads.get(a.teacher_id) || 0) + a.total_periods);
    }
    
    const isImbalanced = [...currentLoads.values()].some(v => v > maxPerTeacher + 3);
    if (!isImbalanced) continue;
    
    console.log(`\n=== Rebalancing ${subjCode} ===`);
    console.log(`  ${eligibleTeachers.length} teachers, ${subjAssigns.length} assignments, ${totalPeriods} periods, target: ${maxPerTeacher}/teacher`);
    
    // Sort assignments consistently
    subjAssigns.sort((a, b) => a.class.name.localeCompare(b.class.name));
    
    // Sort teachers by code
    eligibleTeachers.sort((a, b) => a.code.localeCompare(b.code));
    
    // Round-robin assignment
    const newLoad = new Map();
    eligibleTeachers.forEach(t => newLoad.set(t.id, 0));
    
    let tIdx = 0;
    let moved = 0;
    for (const a of subjAssigns) {
      let placed = false;
      for (let attempt = 0; attempt < eligibleTeachers.length; attempt++) {
        const teacher = eligibleTeachers[(tIdx + attempt) % eligibleTeachers.length];
        const load = newLoad.get(teacher.id) || 0;
        if (load + a.total_periods <= maxPerTeacher + 1) {
          if (a.teacher_id !== teacher.id) {
            await p.teachingAssignment.update({
              where: { id: a.id },
              data: { teacher_id: teacher.id },
            });
            moved++;
          }
          newLoad.set(teacher.id, load + a.total_periods);
          tIdx = (tIdx + attempt + 1) % eligibleTeachers.length;
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Just assign to least loaded
        const sorted = [...newLoad.entries()].sort((a, b) => a[1] - b[1]);
        const [tid] = sorted[0];
        if (a.teacher_id !== tid) {
          await p.teachingAssignment.update({ where: { id: a.id }, data: { teacher_id: tid } });
          moved++;
        }
        newLoad.set(tid, (newLoad.get(tid) || 0) + a.total_periods);
      }
    }
    
    console.log(`  Moved ${moved} assignments`);
    for (const t of eligibleTeachers) {
      console.log(`  ${t.code}: ${newLoad.get(t.id)} periods`);
    }
  }

  // Final report
  console.log('\n=== FINAL LOAD ===');
  const final = await p.teachingAssignment.findMany({ where: { semester_id: semId }, include: { teacher: true } });
  const fl = new Map();
  for (const a of final) fl.set(a.teacher.code, (fl.get(a.teacher.code) || 0) + a.total_periods);
  const sorted = [...fl.entries()].sort((a, b) => b[1] - a[1]);
  let over = 0;
  for (const [code, total] of sorted) {
    if (total > 17) over++;
    console.log(`${code.padEnd(8)} ${String(total).padStart(3)} ${total > 17 ? '⚠️' : '✅'}`);
  }
  console.log(`\nOverloaded: ${over} / ${sorted.length}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
