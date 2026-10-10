import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { Upload, Plus, Utensils, ArrowRight, Check, ImagePlus, Sparkles, Loader2, Flame, TrendingUp, Trash2, Beef, Wheat, Droplet, Leaf, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Heading, SectionTitle, Modal } from '@/components/formai/common';
import { useFormAI, todayKey, type Meal } from '@/components/formai/state';
import { estimateCalories } from '@/lib/estimate-calories';
import { mealMacroInsights, proteinFloor, fibreForCalories, type MacroStatus } from '@/lib/nutrition';
export const Route=createFileRoute('/food')({head:()=>({meta:[{title:'Food — FormAI'},{name:'description',content:'Log your daily meals and estimate calories from a photo with FormAI.'},{property:'og:title',content:'Food — FormAI'},{property:'og:description',content:'Nourish your day with mindful meal tracking.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:Food});

const fmtDate=(key:string)=>new Date(key+'T12:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});

const STATUS_CLASS:Record<MacroStatus,string>={low:'peach','on track':'sage',high:'pink'};

function MacroChip({stat}:{stat:{label:string;value:number;status:MacroStatus;target:string}}){
  return <span className={`macro-chip ${STATUS_CLASS[stat.status]}`} title={`${stat.label} target: ${stat.target}`}>
    <strong>{stat.label} {stat.value}g</strong><em>{stat.status}</em>
  </span>;
}

function CalendarPicker({selected,onSelect,mealDays}:{selected:string;onSelect:(d:string)=>void;mealDays:Set<string>}){
  const today=todayKey();
  const [month,setMonth]=useState(()=>selected.slice(0,7));
  const parts=month.split('-').map(Number);
  const y=parts[0]??1970, m=parts[1]??1;
  const first=new Date(y,m-1,1);
  const startOffset=(first.getDay()+6)%7; // Monday-first
  const daysInMonth=new Date(y,m,0).getDate();
  const cells:(string|null)[]=[...Array.from<string|null>({length:startOffset}).fill(null),...Array.from({length:daysInMonth},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];
  const shift=(n:number)=>{const d=new Date(y,m-1+n,1);setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);};
  return <div className="panel calendar-pop" role="dialog" aria-label="Pick a date">
    <div className="calendar-head">
      <Button variant="ghost" size="icon" aria-label="Previous month" onClick={()=>shift(-1)}><ChevronLeft/></Button>
      <strong>{first.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</strong>
      <Button variant="ghost" size="icon" aria-label="Next month" onClick={()=>shift(1)} disabled={month>=today.slice(0,7)}><ChevronRight/></Button>
    </div>
    <div className="calendar-grid">
      {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=><span key={d} className="calendar-dow">{d}</span>)}
      {cells.map((key,i)=>key===null?<span key={`e${i}`}/>:(
        <button key={key} type="button" disabled={key>today} onClick={()=>onSelect(key)}
          className={`calendar-day${key===selected?' selected':''}${key===today?' today':''}`}
          aria-label={fmtDate(key)} aria-pressed={key===selected}>
          {Number(key.slice(8))}
          {mealDays.has(key)&&<span className="calendar-dot" aria-hidden="true"/>}
        </button>
      ))}
    </div>
  </div>;
}

function PieChart({macros}:{macros:{label:string;value:number;goal:number;icon:any;tone:string}[]}){
  const total=macros.reduce((sum,m)=>sum+m.value,0);
  if(total===0)return null;
  
  // Calculate angles for the pie chart
  const angles=macros.map(m=>{
    const angle=(m.value/total)*360;
    return {label:m.label,value:m.value,percentage:Math.round((m.value/total)*100),angle,tone:m.tone};
  });
  
  // Build SVG path for pie chart
  let cumulativeAngle=0;
  const paths=angles.map((a,i)=>{
    const startAngle=cumulativeAngle;
    cumulativeAngle+=a.angle;
    const endAngle=cumulativeAngle;
    
    // Convert to radians for SVG arc
    const startRad=(startAngle-90)*(Math.PI/180);
    const endRad=(endAngle-90)*(Math.PI/180);
    
    const radius=45;
    const centerX=50;
    const centerY=50;
    
    const x1=centerX+radius*Math.cos(startRad);
    const y1=centerY+radius*Math.sin(startRad);
    const x2=centerX+radius*Math.cos(endRad);
    const y2=centerY+radius*Math.sin(endRad);
    
    const largeArcFlag=a.angle>180?1:0;
    
    return {
      d:`M${centerX},${centerY} L${x1},${y1} A${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2} Z`,
      fill:`var(--${a.tone})`,
      label:a.label,
      percentage:a.percentage,
      value:a.value,
      tone:a.tone
    };
  });
  
  return <div className="pie-chart-container">
    <div className="pie-chart-wrapper">
      <svg width="120" height="120" viewBox="0 0 100 100" className="pie-chart">
        {paths.map((p,i)=>(
          <path key={i} d={p.d} fill={p.fill} stroke="var(--card)" strokeWidth="1"/>
        ))}
        <circle cx="50" cy="50" r="25" fill="var(--card)"/>
        <circle cx="50" cy="50" r="23" fill="var(--card)" stroke="var(--border)" strokeWidth="1"/>
        <text x="50" y="48" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--primary)">Macros</text>
        <text x="50" y="62" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{total}g</text>
      </svg>
    </div>
    <div className="pie-chart-legend">
      {angles.map((a,i)=>(
        <div key={i} className="pie-legend-item">
          <span className="pie-legend-color" style={{backgroundColor:`var(--${a.tone})`}}/>
          <div className="pie-legend-text">
            <span className="pie-legend-label">{a.label}</span>
            <span className="pie-legend-value">{a.value}g ({a.percentage}%)</span>
          </div>
        </div>
      ))}
    </div>
  </div>;
}

function Food(){
  const {meals,addMeal,clearMeals,workouts,weight}=useFormAI();
  const today=todayKey();
  const [selectedDate,setSelectedDate]=useState(today);
  const [calOpen,setCalOpen]=useState(false);
  const [modal, setModal] = useState(false);
  const [photo, setPhoto] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [type, setType] = useState('Lunch');
  const [estimateNotes, setEstimateNotes] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fibre, setFibre] = useState('');
  const dayMeals = useMemo(() => meals.filter(m => m.date === selectedDate), [meals, selectedDate]);
  const mealDays = useMemo(() => new Set(meals.map(m => m.date)), [meals]);
  const total = dayMeals.reduce((s, m) => s + m.calories, 0);
  const burned = selectedDate === today ? workouts * 165 : 0;
  const net = total - burned;
  const macroTotals=dayMeals.reduce((s,m)=>({protein:s.protein+m.macros.protein,carbs:s.carbs+m.macros.carbs,fat:s.fat+m.macros.fat,fibre:s.fibre+m.macros.fibre}),{protein:0,carbs:0,fat:0,fibre:0});
  // Goals from standard macro formulas on a 2,000 kcal demo day (see lib/nutrition)
  const DAILY={calories:2000,protein:proteinFloor(weight),carbs:Math.round(2000*0.55/4),fat:Math.round(2000*0.275/9),fibre:fibreForCalories(2000)};
  const macros=[
    {label:'Protein',value:macroTotals.protein,goal:DAILY.protein,icon:Beef,tone:'pink',hint:`0.8 g × ${weight} kg body weight`,range:`${DAILY.protein} g minimum`},
    {label:'Carbohydrates',value:macroTotals.carbs,goal:DAILY.carbs,icon:Wheat,tone:'peach',hint:'45–65% of daily calories',range:'225–325 g on 2,000 kcal'},
    {label:'Fat',value:macroTotals.fat,goal:DAILY.fat,icon:Droplet,tone:'lilac',hint:'20–35% of daily calories',range:'44–78 g on 2,000 kcal'},
    {label:'Fibre',value:macroTotals.fibre,goal:DAILY.fibre,icon:Leaf,tone:'sage',hint:'14 g per 1,000 kcal eaten',range:`${DAILY.fibre} g on 2,000 kcal`},
  ];
  const estimate=async(dataUrl:string)=>{setEstimating(true);setEstimateError('');setEstimateNotes('');try{const [meta='',data='']=dataUrl.split(',');const mimeType=/data:(.*?);/.exec(meta)?.[1]??'image/jpeg';const result=await estimateCalories({data:{imageBase64:data,mimeType}});setName(result.name);setCalories(String(result.calories));setProtein(String(result.protein));setCarbs(String(result.carbs));setFat(String(result.fat));setFibre(String(result.fibre));setEstimateNotes(result.notes);}catch{setEstimateError('We couldn’t read this photo right now. Please try another image, or enter calories manually below.');}finally{setEstimating(false);}};
  const upload=(f:File|undefined)=>{if(!f)return;if(!f.type.startsWith('image/')){setError('Please choose an image.');return;}if(f.size>10*1024*1024){setError('Please choose an image smaller than 10 MB.');return;}setError('');const reader=new FileReader();reader.onload=()=>{if(typeof reader.result==='string'){setPhoto(reader.result);setName('');setCalories('');setProtein('');setCarbs('');setFat('');setFibre('');setModal(true);estimate(reader.result);}};reader.readAsDataURL(f);};
  const pickDate=(d:string)=>{setSelectedDate(d);setCalOpen(false);};
  const isToday=selectedDate===today;
  return <><Heading title="Nourish your day." subtitle="A feel-good relationship with food, one meal at a time." eyebrow="FOOD · A LITTLE NOURISHMENT"/>
  <div className="section-heading"><div className="choice-row">
    <Button variant="outline" onClick={()=>setCalOpen(o=>!o)} aria-expanded={calOpen}><CalendarDays/>{isToday?'Today':fmtDate(selectedDate)}</Button>
    {!isToday&&<Button variant="ghost" size="sm" onClick={()=>setSelectedDate(today)}>Back to today</Button>}
  </div><span className="subtle-label">Pick a date to see its meals or log for that day</span></div>
  {calOpen&&<><CalendarPicker selected={selectedDate} onSelect={pickDate} mealDays={mealDays}/><div className="day-summary panel"><strong>{fmtDate(selectedDate)}</strong><span>{dayMeals.length===0?'No meals logged':`${dayMeals.length} ${dayMeals.length===1?'meal':'meals'} · ${total.toLocaleString()} kcal · P ${macroTotals.protein}g · C ${macroTotals.carbs}g · F ${macroTotals.fat}g`}</span>{dayMeals.length>0&&<span className="goal-pct">{Math.round((total/DAILY.calories)*100)}% of demo goal</span>}</div></>}
  <div className="detail-grid"><section><SectionTitle title={isToday?'Today’s plate':`Plate for ${fmtDate(selectedDate)}`}><div className="flex gap-2">{dayMeals.length>0&&<Button variant="ghost" size="sm" onClick={()=>clearMeals(selectedDate)}><Trash2/>Clear</Button>}<Button variant="outline" size="sm" onClick={()=>{setPhoto('');setName('');setCalories('');setProtein('');setCarbs('');setFat('');setFibre('');setEstimateNotes('');setEstimateError('');setModal(true);}}><Plus/>Log a meal</Button></div></SectionTitle><div className="panel"><div className="stat-top">Calories logged {isToday?'today':'this day'}<Utensils size={20}/></div><div className="stat-value">{total.toLocaleString()}<small>/ {DAILY.calories.toLocaleString()} kcal demo goal</small></div><progress className="w-full mt-4 accent-primary h-2" value={total} max={Math.max(total,DAILY.calories)} aria-label="Calories logged"/><div className="goal-row"><p>{Math.max(0,DAILY.calories-total).toLocaleString()} kcal remaining · Sample goal, not dietary advice</p><span className="goal-pct">{Math.round((total/DAILY.calories)*100)}% complete</span></div></div>{dayMeals.length===0?<div className="panel mt-5"><div className="empty-state"><Utensils size={26}/><p className="mt-3">No meals logged {isToday?'yet — your plate is a blank canvas':'on this day'}. Upload a photo of your meal and we’ll estimate the calories for you, or log one manually.</p></div></div>:<div className="activity-list mt-5">{dayMeals.map((m,i)=><div className="activity-row" key={`${m.name}-${i}`}>{m.photo?<img className="meal-thumb" src={m.photo} alt={m.name}/>:<span className="meal-thumb stat-icon pink"><Utensils size={16}/></span>}<div><h4>{m.name}</h4><p>{m.type} · {m.source==='photo'?'Photo estimate':'Manually logged'} · P {m.macros.protein}g · C {m.macros.carbs}g · F {m.macros.fat}g · Fibre {m.macros.fibre}g</p></div><time>{m.calories} kcal</time></div>)}</div>}<div className="notice"><Sparkles size={20}/><span>Photo estimates come from a vision model and are rough guesses from a single image — portions and ingredients can be off. Treat them as a starting point, not dietary advice.</span></div></section><section><SectionTitle title="What’s on your plate?"/><div className="camera-frame" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files[0]);}}><Upload/><h3>A picture of nourishment.</h3><p>Add a food photo and our vision model will estimate its calories, or log your meal manually.</p><Button onClick={()=>input.current?.click()}><Upload/>Upload food photo</Button><input ref={input} type="file" accept="image/*" className="hidden" aria-label="Choose a food photo" onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/><span className="subtle-label">JPG, PNG or WEBP · Up to 10 MB · {isToday?'Logs to today':<>Logs to <strong>{fmtDate(selectedDate)}</strong></>}</span>{error&&<p role="alert">{error}</p>}</div><div className="mt-6"><SectionTitle title="Food insights" subtitle={isToday?'Your day at a glance.':`${fmtDate(selectedDate)} at a glance.`}/><div className="stats-grid">{[{label:'Calories in',value:total.toLocaleString(),unit:'kcal',icon:Utensils,tone:'pink',foot:`${dayMeals.length} ${dayMeals.length===1?'meal':'meals'} logged`,hint:total>0?'Logged and counting':'Nothing logged yet'},{label:'Calories burned',value:burned.toLocaleString(),unit:'kcal',icon:Flame,tone:'peach',foot:`${workouts} ${workouts===1?'workout':'workouts'} this session`,hint:isToday?(workouts>0?'Nice movement':'No workouts yet'):'Counted for today only'},{label:'Net',value:net.toLocaleString(),unit:'kcal',icon:TrendingUp,tone:'lilac',foot:'In − burned',hint:'Balance, gently'}].map(s=><div key={s.label} className="stat-card"><div className="stat-top">{s.label}<span className={`stat-icon ${s.tone}`}><s.icon size={15}/></span></div><div className="stat-value">{s.value}<small>{s.unit}</small></div><p className="stat-foot">{s.foot}</p><p className="stat-foot"><strong>{s.hint}</strong></p></div>)}</div><div className="panel mt-5"><SectionTitle title="Nutrition chart" subtitle="Macros vs. daily demo goals."/>{dayMeals.length===0?<div className="empty-state"><Beef size={24}/><p className="mt-3">Log a meal to see your protein, carbs, fat and fibre fill up here — we’ll show how much of each daily goal you’ve completed.</p></div>:<div>{macros.map(m=>{const pct=Math.round((m.value/m.goal)*100);return <div className="macro-row" key={m.label}><div className="macro-head"><span className={`stat-icon ${m.tone}`}><m.icon size={14}/></span><div><strong>{m.label}</strong><p>{m.hint} · {m.range}</p></div><span className="macro-nums">{m.value} / {m.goal} g · <em>{pct}%</em></span></div><progress className={`macro-bar ${m.tone}`} value={Math.min(pct,100)} max={100} aria-label={`${m.label} goal progress`}/></div>;})}</div>}<p className="health-note">Goals use standard formulas on a 2,000 kcal demo day — protein 0.8 g × your weight, carbs 45–65% and fat 20–35% of calories, fibre 14 g per 1,000 kcal. Sample values, not dietary advice.</p></div><div className="panel mt-5"><SectionTitle title="Meal macro insights" subtitle="Each meal vs. the macro formulas."/>{dayMeals.length===0?<div className="empty-state"><Beef size={24}/><p className="mt-3">Log a meal and we’ll check its protein, carbs, fat and fibre against the standard formulas for that meal’s calories.</p></div>:<div>{dayMeals.map((m:Meal,i:number)=>{const stats=mealMacroInsights(m,weight);return <div className="meal-insight" key={`mi-${m.name}-${i}`}><div className="meal-insight-head"><strong>{m.name}</strong><span>{m.calories} kcal · {m.type}</span></div><div className="macro-chips">{stats.map(s=><MacroChip key={s.key} stat={s}/>)}</div></div>;})}</div>}<p className="health-note">Chips compare each meal with its formula target — carbs 45–65% and fat 20–35% of the meal’s calories, protein a third of your 0.8 g × weight daily floor, fibre 14 g per 1,000 kcal. Sample values, not dietary advice.</p></div></div></section></div>{modal&&<Modal title={isToday?'Log a little nourishment':`Log for ${fmtDate(selectedDate)}`} onClose={()=>setModal(false)}>{photo&&<img className="uploaded-photo mb-4" src={photo} alt="Your uploaded meal"/>}{estimating&&<div className="notice mb-4"><Loader2 className="animate-spin" size={19}/><span>The vision model is looking at your photo and estimating calories…</span></div>}{estimateNotes&&<p className="health-note mb-4"><Sparkles size={13} className="inline mr-1"/>{estimateNotes} · Check the values below before saving.</p>}{estimateError&&<div className="notice pink mb-4"><ImagePlus size={19}/><span>{estimateError}</span></div>}<form onSubmit={e=>{e.preventDefault();addMeal({name:name.trim(),calories:Number(calories),type,source:photo?'photo':'manual',date:selectedDate,photo:photo||undefined,macros:{protein:Number(protein)||0,carbs:Number(carbs)||0,fat:Number(fat)||0,fibre:Number(fibre)||0}});setModal(false);setName('');setCalories('');setProtein('');setCarbs('');setFat('');setFibre('');setPhoto('');setEstimateNotes('');setEstimateError('');}}><div className="form-grid"><label className="field full">Meal name<input required maxLength={80} placeholder="e.g. Fresh harvest bowl" value={name} onChange={e=>setName(e.target.value)}/></label><label className="field">Calories<input required type="number" min="1" max="10000" value={calories} onChange={e=>setCalories(e.target.value)} placeholder="520"/></label><label className="field">Meal<select value={type} onChange={e=>setType(e.target.value)}>{['Breakfast','Lunch','Dinner','Snack'].map(t=><option key={t}>{t}</option>)}</select></label><label className="field">Protein (g)<input type="number" min="0" max="1000" value={protein} onChange={e=>setProtein(e.target.value)} placeholder="32"/></label><label className="field">Carbs (g)<input type="number" min="0" max="1000" value={carbs} onChange={e=>setCarbs(e.target.value)} placeholder="45"/></label><label className="field">Fat (g)<input type="number" min="0" max="1000" value={fat} onChange={e=>setFat(e.target.value)} placeholder="18"/></label><label className="field">Fibre (g)<input type="number" min="0" max="200" value={fibre} onChange={e=>setFibre(e.target.value)} placeholder="8"/></label><p className="field full subtle-label">Macros are optional — photo estimates fill them in for you.</p></div><div className="form-actions"><Button type="submit" disabled={estimating||!name.trim()||!calories}><Check/>Save meal</Button><Button type="button" variant="ghost" onClick={()=>setModal(false)}>Cancel<ArrowRight/></Button></div></form></Modal>}</>;
}
