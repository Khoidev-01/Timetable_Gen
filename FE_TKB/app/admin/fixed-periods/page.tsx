'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, LockOpen, Pin, Plus, Trash2 } from 'lucide-react';
import { API_URL } from '@/lib/api';
import Select, { type SelectOption } from '@/app/components/ui/Select';

interface Rule { id:string; name:string; subject_code:string; day_of_week:number; period:number; grade_level:number|null; main_session:number|null; teacher_rule:'HOMEROOM'|'BGH'|'ASSIGNED'; is_locked:boolean; is_active:boolean; sort_order:number }
interface Draft { name:string; subject_code:string; day_of_week:number; period:number; grade_level:string|number; is_locked:boolean }

const DAYS=[2,3,4,5,6,7], PERIODS=[1,2,3,4,5,6,7,8,9,10];
const DAY_LABEL:Record<number,string>={2:'Thứ hai',3:'Thứ ba',4:'Thứ tư',5:'Thứ năm',6:'Thứ sáu',7:'Thứ bảy'};
// Ô ở buổi sáng chỉ ghim cho lớp học buổi sáng, ô buổi chiều chỉ ghim cho lớp học buổi chiều.
const sessionOf=(period:number)=>period<=5?0:1;
const createDraft=(day=2,period=1):Draft=>({name:'',subject_code:'',day_of_week:day,period,grade_level:'',is_locked:true});
const authHeaders=()=>({'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')??''}`});

export default function FixedPeriodsPage(){
  const [rules,setRules]=useState<Rule[]>([]);
  const [subjects,setSubjects]=useState<Array<{code:string;name:string}>>([]);
  const [selected,setSelected]=useState({day:2,period:1});
  const [draft,setDraft]=useState<Draft>(()=>createDraft());
  const [isLoading,setIsLoading]=useState(true);
  const [isSaving,setIsSaving]=useState(false);
  const [message,setMessage]=useState<{text:string;ok:boolean}|null>(null);

  const load=useCallback(async()=>{try{const [ruleRes,subjectRes]=await Promise.all([fetch(`${API_URL}/tiet-co-dinh`,{headers:authHeaders()}),fetch(`${API_URL}/resources/subjects`,{headers:authHeaders()})]);if(ruleRes.ok)setRules(await ruleRes.json());if(subjectRes.ok)setSubjects(await subjectRes.json())}catch(error){console.error(error)}finally{setIsLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  const notify=(text:string,ok:boolean)=>{setMessage({text,ok});window.setTimeout(()=>setMessage(null),4000)};
  const subjectLabel=(code:string)=>code==='GVCN_TEACHING'?'Môn của GVCN':subjects.find(s=>s.code===code)?.name??code;
  const selectCell=(day:number,period:number)=>{setSelected({day,period});setDraft(createDraft(day,period))};
  const scope=(rule:Rule)=>`${rule.grade_level===null?'Mọi khối':`Khối ${rule.grade_level}`}${rule.main_session===null?'':rule.main_session===0?' · lớp học sáng':' · lớp học chiều'}`;

  const createRule=async()=>{if(!draft.subject_code){notify('Hãy chọn môn cần cố định.',false);return}setIsSaving(true);try{const fallback=`${subjectLabel(draft.subject_code)} - ${DAY_LABEL[draft.day_of_week]}, tiết ${draft.period<=5?draft.period:draft.period-5} ${draft.period<=5?'sáng':'chiều'}`;const isHomeroomSubject=draft.subject_code==='GVCN_TEACHING';const res=await fetch(`${API_URL}/tiet-co-dinh`,{method:'POST',headers:authHeaders(),body:JSON.stringify({...draft,name:draft.name.trim()||fallback,grade_level:draft.grade_level===''?null:Number(draft.grade_level),main_session:sessionOf(draft.period),teacher_rule:isHomeroomSubject?'HOMEROOM':'ASSIGNED',sort_order:rules.length+1})});if(!res.ok){const body=await res.json().catch(()=>null);notify(body?.message??'Không tạo được tiết cố định.',false);return}setDraft(createDraft(selected.day,selected.period));await load();notify(isHomeroomSubject?'Đã ghim môn của GVCN cho từng lớp.':'Đã ghim môn. Giáo viên được lấy tự động từ phân công của từng lớp.',true)}catch(error){console.error(error);notify('Lỗi kết nối khi lưu tiết cố định.',false)}finally{setIsSaving(false)}};
  const patchRule=async(rule:Rule,changes:Partial<Rule>)=>{try{const res=await fetch(`${API_URL}/tiet-co-dinh/${rule.id}`,{method:'PUT',headers:authHeaders(),body:JSON.stringify({...rule,...changes})});if(res.ok)setRules(current=>current.map(item=>item.id===rule.id?{...item,...changes}:item))}catch(error){console.error(error)}};
  const deleteRule=async(rule:Rule)=>{try{const res=await fetch(`${API_URL}/tiet-co-dinh/${rule.id}`,{method:'DELETE',headers:authHeaders()});if(res.ok){setRules(current=>current.filter(item=>item.id!==rule.id));notify('Đã xóa tiết cố định.',true)}}catch(error){console.error(error)}};
  const input='min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';
  const selectedRules=rules.filter(rule=>rule.day_of_week===selected.day&&rule.period===selected.period);
  const subjectOptions:SelectOption[]=[
    {value:'GVCN_TEACHING',label:'Môn của GVCN',description:'Mỗi lớp tự dùng môn mà GVCN đang được phân công giảng dạy.'},
    ...subjects.map(subject=>({value:subject.code,label:`${subject.name} (${subject.code})`})),
  ];
  const gradeOptions:SelectOption[]=[
    {value:'',label:'Mọi khối'},
    {value:'10',label:'Khối 10'},
    {value:'11',label:'Khối 11'},
    {value:'12',label:'Khối 12'},
  ];

  return <div className="space-y-6 pb-16">
    <header className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
      <div className="mb-1 flex items-center gap-2"><Pin size={20} className="text-blue-600"/><h1 className="text-2xl font-bold text-[var(--text-primary)]">Tiết cố định</h1></div>
      <p className="text-sm text-[var(--text-muted)]">Chọn một ô trên thời khóa biểu, sau đó chọn môn cần ghim. Tiết được khóa sẽ không bị thuật toán hoặc thao tác kéo thả di chuyển.</p>
    </header>
    {message&&<div className={`rounded-lg border p-4 ${message.ok?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</div>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-5 py-4"><div><h2 className="font-semibold text-[var(--text-primary)]">Thời khóa biểu cố định</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Bấm vào ô để chọn thời điểm cần ghim môn.</p></div><span className="rounded-md bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)]">{rules.length} quy tắc</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[880px] table-fixed border-collapse text-sm">
          <thead><tr className="bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]"><th className="w-24 border-b border-r border-[var(--border-default)] px-2 py-3">Buổi / Tiết</th>{DAYS.map(day=><th key={day} className="border-b border-r border-[var(--border-default)] px-2 py-3 last:border-r-0">{DAY_LABEL[day]}</th>)}</tr></thead>
          <tbody>{PERIODS.map(period=><tr key={period} className={period===6?'border-t-4 border-t-blue-100':''}>
            <th className="h-24 border-b border-r border-[var(--border-default)] bg-[var(--bg-surface-hover)] px-2 text-center text-[var(--text-primary)]"><span className="block text-xs font-normal text-[var(--text-muted)]">{period<=5?'Sáng':'Chiều'}</span>Tiết {period<=5?period:period-5}</th>
            {DAYS.map(day=>{const cellRules=rules.filter(rule=>rule.day_of_week===day&&rule.period===period);const active=selected.day===day&&selected.period===period;return <td key={day} className="border-b border-r border-[var(--border-default)] p-1.5 align-top last:border-r-0"><button type="button" onClick={()=>selectCell(day,period)} className={`min-h-20 w-full rounded-lg p-2 text-left transition-[transform,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${active?'bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]':'hover:-translate-y-0.5 hover:bg-[var(--bg-surface-hover)]'}`}>
              {isLoading?<span className="text-xs text-[var(--text-muted)]">Đang tải...</span>:cellRules.length===0?<span className="flex min-h-16 items-center justify-center text-xs text-[var(--text-muted)]"><Plus size={15} className="mr-1"/>Chọn môn</span>:<span className="space-y-1.5">{cellRules.map(rule=><span key={rule.id} className={`block rounded-md border px-2 py-1.5 ${rule.is_active?'border-blue-200 bg-blue-50':'border-[var(--border-default)] bg-[var(--bg-surface-hover)] opacity-60'}`}><span className="flex justify-between gap-1"><strong className="line-clamp-2 text-xs text-[var(--text-primary)]">{subjectLabel(rule.subject_code)}</strong>{rule.is_locked&&<Lock size={12} className="shrink-0 text-amber-500"/>}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{scope(rule)}</span></span>)}</span>}
            </button></td>})}
          </tr>)}</tbody>
        </table></div>
      </section>

      <aside className="sticky top-24 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <div className="mb-5 border-b border-[var(--border-default)] pb-4"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Ô đang chọn</p><h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">{DAY_LABEL[selected.day]} - Tiết {selected.period<=5?selected.period:selected.period-5}</h2><p className="text-sm text-[var(--text-muted)]">Chỉ áp dụng cho lớp học buổi {selected.period<=5?'sáng':'chiều'}</p></div>
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm"><span className="font-medium text-[var(--text-secondary)]">Môn cố định</span><Select value={draft.subject_code} options={subjectOptions} placeholder="Chọn môn" searchable searchPlaceholder="Tìm tên hoặc mã môn..." onChange={subjectCode=>setDraft({...draft,subject_code:subjectCode})}/><span className="block text-xs leading-5 text-[var(--text-muted)]">{draft.subject_code==='GVCN_TEACHING'?'Mỗi lớp sẽ xếp đúng môn mà GVCN của lớp đó đang giảng dạy.':'Giáo viên được lấy tự động từ phân công môn của từng lớp.'}</span></label>
          <label className="block space-y-1.5 text-sm"><span className="font-medium text-[var(--text-secondary)]">Tên quy tắc (không bắt buộc)</span><input className={input} value={draft.name} placeholder="Tự tạo theo môn và thời điểm" onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
          <label className="block space-y-1.5 text-sm"><span className="font-medium text-[var(--text-secondary)]">Áp dụng cho</span><Select value={String(draft.grade_level)} options={gradeOptions} placeholder="Chọn khối" onChange={grade=>setDraft({...draft,grade_level:grade})}/></label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg bg-[var(--bg-surface-hover)] px-3 text-sm"><input type="checkbox" checked={draft.is_locked} onChange={e=>setDraft({...draft,is_locked:e.target.checked})}/>Khóa tiết sau khi xếp</label>
          <button type="button" onClick={createRule} disabled={isSaving||!draft.subject_code} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"><Pin size={17}/>{isSaving?'Đang lưu...':'Ghim vào ô đã chọn'}</button>
        </div>
        {selectedRules.length>0&&<div className="mt-5 border-t border-[var(--border-default)] pt-4"><h3 className="mb-3 text-sm font-semibold">Đang ghim tại ô này</h3><div className="space-y-2">{selectedRules.map(rule=><div key={rule.id} className="rounded-lg border border-[var(--border-default)] p-3"><div className="flex justify-between gap-2"><div><p className="text-sm font-semibold">{subjectLabel(rule.subject_code)}</p><p className="text-xs text-[var(--text-muted)]">{scope(rule)}</p></div><button onClick={()=>deleteRule(rule)} className="flex h-9 w-9 items-center justify-center rounded-md text-red-500 hover:bg-red-50"><Trash2 size={16}/></button></div><div className="mt-3 flex gap-2"><button onClick={()=>patchRule(rule,{is_locked:!rule.is_locked})} className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md bg-[var(--bg-surface-hover)] text-xs">{rule.is_locked?<Lock size={14}/>:<LockOpen size={14}/>} {rule.is_locked?'Đã khóa':'Không khóa'}</button><button onClick={()=>patchRule(rule,{is_active:!rule.is_active})} className={`min-h-9 flex-1 rounded-md text-xs ${rule.is_active?'bg-emerald-50 text-emerald-700':'bg-[var(--bg-surface-hover)] text-[var(--text-muted)]'}`}>{rule.is_active?'Đang bật':'Đã tắt'}</button></div></div>)}</div></div>}
      </aside>
    </div>
  </div>
}
