'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, LockOpen, Moon, Pin, Plus, Sun, Trash2 } from 'lucide-react';
import { API_URL } from '@/lib/api';
import Select, { type SelectOption } from '@/app/components/ui/Select';

type Session=0|1;
const SESSION_LABEL:Record<Session,string>={0:'Lớp học buổi sáng',1:'Lớp học buổi chiều'};
interface Rule { id:string; name:string; subject_code:string; day_of_week:number; period:number; grade_level:number|null; main_session:number|null; teacher_rule:'HOMEROOM'|'BGH'|'ASSIGNED'; is_locked:boolean; is_active:boolean; sort_order:number }
interface Draft { name:string; subject_code:string; grade_level:string|number; main_session:Session|null; is_locked:boolean }
interface Cell { day:number; period:number }

const DAYS=[2,3,4,5,6,7], PERIODS=[1,2,3,4,5,6,7,8,9,10];
const DAY_LABEL:Record<number,string>={2:'Thứ hai',3:'Thứ ba',4:'Thứ tư',5:'Thứ năm',6:'Thứ sáu',7:'Thứ bảy'};
// Quy tắc gắn với KHỐI LỚP HỌC BUỔI NÀO (main_session của lớp), không gắn với vị trí ô: lớp học
// buổi sáng vẫn có thể bị ghim một tiết chiều (tiết 6-10) và ngược lại. Người dùng chọn buổi
// trước, lưới hiện đủ tiết 1-10 của buổi đó, ghim gì cũng áp cho khối lớp học buổi đó.
// Mã "môn" đặc biệt: ô được ghim mã này là ô NGHỈ, không lớp nào thuộc khối đã chọn học vào đó,
// dù học buổi nào. Thuật toán coi xếp tiết vào ô nghỉ là lỗi cứng.
const REST='NGHI';
const createDraft=(session:Session=0):Draft=>({name:'',subject_code:'',grade_level:'',main_session:session,is_locked:true});
const sameCell=(a:Cell,b:Cell)=>a.day===b.day&&a.period===b.period;
const cellLabel=(cell:Cell)=>`${DAY_LABEL[cell.day]} - Tiết ${cell.period} (${cell.period<=5?'sáng':'chiều'})`;
const authHeaders=()=>({'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')??''}`});

export default function FixedPeriodsPage(){
  const [rules,setRules]=useState<Rule[]>([]);
  const [subjects,setSubjects]=useState<Array<{code:string;name:string}>>([]);
  const [classes,setClasses]=useState<Array<{grade_level:number;main_session:number}>>([]);
  const [session,setSession]=useState<Session>(0);
  // Chọn được nhiều ô một lúc: bấm ô để thêm/bỏ, rồi ghim một lần cho tất cả
  const [selectedCells,setSelectedCells]=useState<Cell[]>([{day:2,period:1}]);
  const [draft,setDraft]=useState<Draft>(()=>createDraft());
  const [isLoading,setIsLoading]=useState(true);
  const [isSaving,setIsSaving]=useState(false);
  const [message,setMessage]=useState<{text:string;ok:boolean}|null>(null);

  const load=useCallback(async()=>{try{const [ruleRes,subjectRes,classRes]=await Promise.all([fetch(`${API_URL}/tiet-co-dinh`,{headers:authHeaders()}),fetch(`${API_URL}/resources/subjects`,{headers:authHeaders()}),fetch(`${API_URL}/organization/classes`,{headers:authHeaders()})]);if(ruleRes.ok)setRules(await ruleRes.json());if(subjectRes.ok)setSubjects(await subjectRes.json());if(classRes.ok)setClasses(await classRes.json())}catch(error){console.error(error)}finally{setIsLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  const notify=(text:string,ok:boolean)=>{setMessage({text,ok});window.setTimeout(()=>setMessage(null),4000)};
  const subjectLabel=(code:string)=>code===REST?'Nghỉ - không học':code==='GVCN_TEACHING'?'Môn của GVCN':subjects.find(s=>s.code===code)?.name??code;
  const toggleCell=(cell:Cell)=>setSelectedCells(current=>current.some(c=>sameCell(c,cell))?current.filter(c=>!sameCell(c,cell)):[...current,cell].sort((a,b)=>a.day-b.day||a.period-b.period));
  // Buổi chọn ở thẻ trên lưới và ở ô "Buổi áp dụng" trong bảng bên là một; đổi chỗ nào cũng đổi cả hai
  const chooseSession=(value:Session)=>{setSession(value);setDraft(current=>({...current,main_session:value}))};
  const scope=(rule:Rule)=>`${rule.grade_level===null?'Mọi khối':`Khối ${rule.grade_level}`} - ${rule.main_session===null?'mọi buổi':rule.main_session===0?'Buổi sáng':'Buổi chiều'}`;
  // Quy tắc của buổi đang xem: gắn đúng buổi đó, hoặc dùng chung cho mọi buổi (dữ liệu cũ, null)
  const inSession=(rule:Rule)=>rule.main_session===null||rule.main_session===session;
  const sessionRules=rules.filter(inSession);

  const createRule=async()=>{if(!draft.subject_code){notify('Hãy chọn môn cần cố định.',false);return}if(selectedCells.length===0){notify('Hãy bấm chọn ít nhất một ô trên lưới.',false);return}setIsSaving(true);try{const isHomeroomSubject=draft.subject_code==='GVCN_TEACHING';const isRest=draft.subject_code===REST;const failures:string[]=[];let order=rules.length+1;for(const cell of selectedCells){const fallback=`${subjectLabel(draft.subject_code)} - ${cellLabel(cell)}`;const res=await fetch(`${API_URL}/tiet-co-dinh`,{method:'POST',headers:authHeaders(),body:JSON.stringify({name:draft.name.trim()?(selectedCells.length>1?`${draft.name.trim()} - ${cellLabel(cell)}`:draft.name.trim()):fallback,subject_code:draft.subject_code,day_of_week:cell.day,period:cell.period,grade_level:draft.grade_level===''?null:Number(draft.grade_level),main_session:draft.main_session,is_locked:draft.is_locked,teacher_rule:isHomeroomSubject?'HOMEROOM':'ASSIGNED',sort_order:order++})});if(!res.ok){const body=await res.json().catch(()=>null);failures.push(`${cellLabel(cell)}: ${body?.message??'không tạo được'}`)}}await load();const saved=selectedCells.length-failures.length;if(failures.length>0){notify(`Ghim được ${saved}/${selectedCells.length} ô. Lỗi: ${failures.join('; ')}`,saved>0);return}setDraft(createDraft(session));notify(`${isRest?'Đã đánh dấu nghỉ':isHomeroomSubject?'Đã ghim môn của GVCN':`Đã ghim ${subjectLabel(draft.subject_code)}`} vào ${saved} ô - áp dụng cho ${draft.main_session===null?'mọi buổi':SESSION_LABEL[draft.main_session].toLowerCase()}.`,true)}catch(error){console.error(error);notify('Lỗi kết nối khi lưu tiết cố định.',false)}finally{setIsSaving(false)}};
  const patchRule=async(rule:Rule,changes:Partial<Rule>)=>{try{const res=await fetch(`${API_URL}/tiet-co-dinh/${rule.id}`,{method:'PUT',headers:authHeaders(),body:JSON.stringify({...rule,...changes})});if(res.ok)setRules(current=>current.map(item=>item.id===rule.id?{...item,...changes}:item))}catch(error){console.error(error)}};
  const deleteRule=async(rule:Rule)=>{try{const res=await fetch(`${API_URL}/tiet-co-dinh/${rule.id}`,{method:'DELETE',headers:authHeaders()});if(res.ok){setRules(current=>current.filter(item=>item.id!==rule.id));notify('Đã xóa tiết cố định.',true)}}catch(error){console.error(error)}};
  const input='min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';
  const selectedRules=sessionRules.filter(rule=>selectedCells.some(cell=>cell.day===rule.day_of_week&&cell.period===rule.period));
  const subjectOptions:SelectOption[]=[
    {value:REST,label:'Nghỉ (không học)',description:'Không lớp nào thuộc khối đã chọn học vào ô này. Ô sẽ tô đỏ.'},
    {value:'GVCN_TEACHING',label:'Môn của GVCN',description:'Mỗi lớp tự dùng môn mà GVCN đang được phân công giảng dạy.'},
    ...subjects.map(subject=>({value:subject.code,label:`${subject.name} (${subject.code})`})),
  ];
  // Một ô chọn duy nhất: khối + buổi. Các cặp "Khối N - Buổi X" lấy từ danh sách lớp thật,
  // nên chỉ hiện những tổ hợp đang có lớp (vd. khối 11 học chiều thì không có "Khối 11 - Buổi sáng").
  const targetValue=(grade:string|number,sessionValue:Session|null)=>`${grade===''?'all':grade}:${sessionValue===null?'all':sessionValue}`;
  const targetOptions:SelectOption[]=[
    {value:targetValue('',null),label:'Mọi khối - mọi buổi',description:'Tất cả lớp trong trường.'},
    {value:targetValue('',0),label:'Mọi khối - Buổi sáng',description:`Mọi lớp học chính buổi sáng (${classes.filter(c=>c.main_session===0).length} lớp).`},
    {value:targetValue('',1),label:'Mọi khối - Buổi chiều',description:`Mọi lớp học chính buổi chiều (${classes.filter(c=>c.main_session===1).length} lớp).`},
    ...[...new Map(classes.map(c=>[`${c.grade_level}:${c.main_session}`,c])).values()]
      .sort((a,b)=>a.grade_level-b.grade_level||a.main_session-b.main_session)
      .map(c=>({value:targetValue(c.grade_level,c.main_session as Session),label:`Khối ${c.grade_level} - ${c.main_session===0?'Buổi sáng':'Buổi chiều'}`,description:`${classes.filter(x=>x.grade_level===c.grade_level&&x.main_session===c.main_session).length} lớp`})),
  ];
  const chooseTarget=(value:string)=>{const [grade,sessionPart]=value.split(':');const nextSession=sessionPart==='all'?null:(Number(sessionPart) as Session);setDraft(current=>({...current,grade_level:grade==='all'?'':Number(grade),main_session:nextSession}));if(nextSession!==null)setSession(nextSession)};

  return <div className="space-y-6 pb-16">
    <header className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
      <div className="mb-1 flex items-center gap-2"><Pin size={20} className="text-blue-600"/><h1 className="text-2xl font-bold text-[var(--text-primary)]">Tiết cố định</h1></div>
      <p className="text-sm text-[var(--text-muted)]">Chọn một ô trên thời khóa biểu, sau đó chọn môn cần ghim. Tiết được khóa sẽ không bị thuật toán hoặc thao tác kéo thả di chuyển.</p>
    </header>
    {message&&<div className={`rounded-lg border p-4 ${message.ok?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</div>}

    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Khối lớp học buổi nào?</p>
      <div className="grid gap-3 sm:grid-cols-2" role="tablist" aria-label="Chọn buổi học">
        {([0,1] as Session[]).map(value=>{const active=session===value;const count=rules.filter(rule=>rule.main_session===value).length;return <button key={value} type="button" role="tab" aria-selected={active} onClick={()=>chooseSession(value)} className={`flex min-h-16 items-center gap-3 rounded-lg border px-4 text-left transition-colors ${active?'border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]':'border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]'}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${value===0?'bg-amber-100 text-amber-600':'bg-indigo-100 text-indigo-600'}`}>{value===0?<Sun size={20}/>:<Moon size={20}/>}</span>
          <span><span className="block font-semibold text-[var(--text-primary)]">{SESSION_LABEL[value]}</span><span className="block text-xs text-[var(--text-muted)]">Tiết 1-5 sáng, 6-10 chiều; ghim gì cũng áp cho các lớp học chính buổi này · {count} quy tắc riêng</span></span>
        </button>})}
      </div>
    </section>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-5 py-4"><div><h2 className="font-semibold text-[var(--text-primary)]">Thời khóa biểu cố định - {SESSION_LABEL[session].toLowerCase()}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Bấm vào ô để chọn, bấm lại để bỏ; chọn được nhiều ô rồi ghim một lần. Quy tắc dùng chung cho mọi buổi cũng hiện ở đây.</p></div><span className="rounded-md bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)]">{sessionRules.length} quy tắc</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[880px] table-fixed border-collapse text-sm">
          <thead><tr className="bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]"><th className="w-24 border-b border-r border-[var(--border-default)] px-2 py-3">Buổi / Tiết</th>{DAYS.map(day=><th key={day} className="border-b border-r border-[var(--border-default)] px-2 py-3 last:border-r-0">{DAY_LABEL[day]}</th>)}</tr></thead>
          <tbody>{PERIODS.map(period=><tr key={period} className={period===6?'border-t-4 border-t-blue-100':''}>
            <th className="h-24 border-b border-r border-[var(--border-default)] bg-[var(--bg-surface-hover)] px-2 text-center text-[var(--text-primary)]"><span className="block text-xs font-normal text-[var(--text-muted)]">{period<=5?'Sáng':'Chiều'}</span>Tiết {period}</th>
            {DAYS.map(day=>{const cellRules=sessionRules.filter(rule=>rule.day_of_week===day&&rule.period===period);const active=selectedCells.some(cell=>cell.day===day&&cell.period===period);const isRestCell=cellRules.some(rule=>rule.subject_code===REST&&rule.is_active);return <td key={day} className="border-b border-r border-[var(--border-default)] p-1.5 align-top last:border-r-0"><button type="button" onClick={()=>toggleCell({day,period})} aria-pressed={active} className={`min-h-20 w-full rounded-lg p-2 text-left transition-[transform,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${isRestCell?`bg-red-100 ${active?'ring-2 ring-red-500':'ring-1 ring-red-300 hover:-translate-y-0.5'}`:active?'bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]':'hover:-translate-y-0.5 hover:bg-[var(--bg-surface-hover)]'}`}>
              {isLoading?<span className="text-xs text-[var(--text-muted)]">Đang tải...</span>:cellRules.length===0?<span className="flex min-h-16 items-center justify-center text-xs text-[var(--text-muted)]"><Plus size={15} className="mr-1"/>Chọn môn</span>:<span className="space-y-1.5">{cellRules.map(rule=><span key={rule.id} className={`block rounded-md border px-2 py-1.5 ${!rule.is_active?'border-[var(--border-default)] bg-[var(--bg-surface-hover)] opacity-60':rule.subject_code===REST?'border-red-400 bg-red-200':'border-blue-200 bg-blue-50'}`}><span className="flex justify-between gap-1"><strong className={`line-clamp-2 text-xs ${rule.subject_code===REST&&rule.is_active?'text-red-800':'text-[var(--text-primary)]'}`}>{subjectLabel(rule.subject_code)}</strong>{rule.is_locked&&<Lock size={12} className="shrink-0 text-amber-500"/>}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{scope(rule)}</span></span>)}</span>}
            </button></td>})}
          </tr>)}</tbody>
        </table></div>
      </section>

      <aside className="sticky top-24 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <div className="mb-5 border-b border-[var(--border-default)] pb-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{selectedCells.length<=1?'Ô đang chọn':`${selectedCells.length} ô đang chọn`}</p>{selectedCells.length>0&&<button type="button" onClick={()=>setSelectedCells([])} className="text-xs text-[var(--accent)] hover:underline">Bỏ chọn tất cả</button>}</div>
          {selectedCells.length===0?<h2 className="mt-1 text-lg font-bold text-[var(--text-muted)]">Chưa chọn ô nào</h2>:selectedCells.length===1?<h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">{DAY_LABEL[selectedCells[0].day]} - Tiết {selectedCells[0].period} <span className="text-sm font-normal text-[var(--text-muted)]">({selectedCells[0].period<=5?'sáng':'chiều'})</span></h2>:<div className="mt-2 flex flex-wrap gap-1.5">{selectedCells.map(cell=><button key={`${cell.day}-${cell.period}`} type="button" onClick={()=>toggleCell(cell)} title="Bỏ chọn ô này" className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-red-50 hover:text-red-600">{DAY_LABEL[cell.day].replace('Thứ ','T')} · Tiết {cell.period} ×</button>)}</div>}<p className="text-sm text-[var(--text-muted)]">Áp dụng cho <strong className="text-[var(--text-primary)]">{draft.main_session===null?'mọi buổi':SESSION_LABEL[draft.main_session].toLowerCase()}</strong>{draft.subject_code===REST?' - giờ này các lớp đó nghỉ.':'.'}</p></div>
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm"><span className="font-medium text-[var(--text-secondary)]">Môn cố định</span><Select value={draft.subject_code} options={subjectOptions} placeholder="Chọn môn" searchable searchPlaceholder="Tìm tên hoặc mã môn..." onChange={subjectCode=>setDraft({...draft,subject_code:subjectCode})}/><span className="block text-xs leading-5 text-[var(--text-muted)]">{draft.subject_code===REST?'Ô này sẽ tô đỏ. Các lớp thuộc khối và buổi đã chọn không học vào giờ này.':draft.subject_code==='GVCN_TEACHING'?'Mỗi lớp sẽ xếp đúng môn mà GVCN của lớp đó đang giảng dạy.':'Giáo viên được lấy tự động từ phân công môn của từng lớp.'}</span></label>
          <label className="block space-y-1.5 text-sm"><span className="font-medium text-[var(--text-secondary)]">Tên quy tắc (không bắt buộc)</span><input className={input} value={draft.name} placeholder="Tự tạo theo môn và thời điểm" onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
          <label className="block space-y-1.5 text-sm"><span className="font-medium text-[var(--text-secondary)]">Khối áp dụng</span><Select value={targetValue(draft.grade_level,draft.main_session)} options={targetOptions} placeholder="Chọn khối" onChange={chooseTarget}/></label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg bg-[var(--bg-surface-hover)] px-3 text-sm"><input type="checkbox" checked={draft.is_locked} onChange={e=>setDraft({...draft,is_locked:e.target.checked})}/>Khóa tiết sau khi xếp</label>
          <button type="button" onClick={createRule} disabled={isSaving||!draft.subject_code||selectedCells.length===0} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"><Pin size={17}/>{isSaving?'Đang lưu...':selectedCells.length>1?`Ghim vào ${selectedCells.length} ô đã chọn`:'Ghim vào ô đã chọn'}</button>
        </div>
        {selectedRules.length>0&&<div className="mt-5 border-t border-[var(--border-default)] pt-4"><h3 className="mb-3 text-sm font-semibold">{selectedCells.length>1?'Đang ghim tại các ô đã chọn':'Đang ghim tại ô này'}</h3><div className="space-y-2">{selectedRules.map(rule=><div key={rule.id} className="rounded-lg border border-[var(--border-default)] p-3"><div className="flex justify-between gap-2"><div><p className="text-sm font-semibold">{subjectLabel(rule.subject_code)}</p><p className="text-xs text-[var(--text-muted)]">{selectedCells.length>1?`${DAY_LABEL[rule.day_of_week]} · Tiết ${rule.period} · `:''}{scope(rule)}</p></div><button onClick={()=>deleteRule(rule)} className="flex h-9 w-9 items-center justify-center rounded-md text-red-500 hover:bg-red-50"><Trash2 size={16}/></button></div><div className="mt-3 flex gap-2"><button onClick={()=>patchRule(rule,{is_locked:!rule.is_locked})} className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md bg-[var(--bg-surface-hover)] text-xs">{rule.is_locked?<Lock size={14}/>:<LockOpen size={14}/>} {rule.is_locked?'Đã khóa':'Không khóa'}</button><button onClick={()=>patchRule(rule,{is_active:!rule.is_active})} className={`min-h-9 flex-1 rounded-md text-xs ${rule.is_active?'bg-emerald-50 text-emerald-700':'bg-[var(--bg-surface-hover)] text-[var(--text-muted)]'}`}>{rule.is_active?'Đang bật':'Đã tắt'}</button></div></div>)}</div></div>}
      </aside>
    </div>
  </div>
}
