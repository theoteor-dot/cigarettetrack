import { useState, useEffect, useRef } from "react";

const today    = () => new Date().toISOString().slice(0,10);
const fmtShort = (d) => new Date(d+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
const msm      = (t) => { if(!t)return null; const[h,m]=t.split(":").map(Number); return h*60+m; };
const fmtDur   = (m) => { if(m===null||m===undefined||isNaN(m))return"–"; if(m<60)return`${m} min`; return`${Math.floor(m/60)}h${String(m%60).padStart(2,"0")}`; };
const nowHHMM  = () => { const n=new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`; };

const SK    = "smk_tracker_v7";
const SET_K = "smk_settings_v7";
const EXP_K = "smk_expenses_v7";
const loadData     = () => { try{ return JSON.parse(localStorage.getItem(SK))||{}; }catch{return{};} };
const loadSettings = () => { try{ const s=JSON.parse(localStorage.getItem(SET_K)); return s?{...defSettings(),...s}:defSettings(); }catch{return defSettings();} };
const loadExpenses = () => { try{ return JSON.parse(localStorage.getItem(EXP_K))||[]; }catch{return[];} };
const saveData     = (d) => localStorage.setItem(SK, JSON.stringify(d));
const saveSettings = (s) => localStorage.setItem(SET_K, JSON.stringify(s));
const saveExpenses = (e) => localStorage.setItem(EXP_K, JSON.stringify(e));

const defDay = () => ({ cigs:[], cigFactors:{}, cigCravings:{}, cigTypes:{}, wakeUp:"", lunch:"", dinner:"", bedtime:"", goal:10, note:"" });

const DEF_LAYOUTS = {
  home:    ["counter","timeline","cigs"],
  stats:   ["summary","cost","hours"],
  progres: ["streak","heatmap","badges"],
  analyse: ["factors","cravings"],
};

const defSettings = () => ({
  defaultGoal:10, name:"", currency:"€", pricePerPack:12, cigsPerPack:20, usualCigs:20,
  darkMode:false, autoDark:true,
  showFactors:true, showCravings:true, showEvents:true,
  smokeTypes:["cigarette"],
  cycleTracking:false, cycleStartDate:"", cycleDays:28,
  layouts: DEF_LAYOUTS,
});

// Detect if current time is in the night window (between bedtime and wakeUp)
const isNightTime = (data) => {
  const dk = today();
  const todayD = data[dk]||defDay();
  const yest = new Date(); yest.setDate(yest.getDate()-1);
  const yk = yest.toISOString().slice(0,10);
  const yesterdayD = data[yk]||defDay();
  const nowM = (() => { const n=new Date(); return n.getHours()*60+n.getMinutes(); })();
  const wakeM = msm(todayD.wakeUp);
  const bedM_y = msm(yesterdayD.bedtime);
  const bedM_t = msm(todayD.bedtime);
  // Before wakeup this morning
  if(wakeM!==null && nowM < wakeM) return true;
  // After bedtime yesterday (crosses midnight)
  if(bedM_y!==null && nowM > bedM_y) return true;
  // After bedtime today
  if(bedM_t!==null && nowM > bedM_t) return true;
  // Fallback: 22h–7h if no events set
  if(bedM_y===null && bedM_t===null && wakeM===null) {
    if(nowM >= 22*60 || nowM < 7*60) return true;
  }
  return false;
};

const SMOKE_TYPES = [
  { id:"cigarette", emoji:"🚬", label:"Cigarette" },
  { id:"vape",      emoji:"💨", label:"Vape"       },
  { id:"joint",     emoji:"🌿", label:"Joint"      },
];

const EXPENSE_CATS = [
  { id:"cigarette", emoji:"🚬", label:"Cigarettes" },
  { id:"tabac",     emoji:"🍂", label:"Tabac + feuilles + filtres" },
  { id:"vape",      emoji:"💨", label:"Vape / recharge" },
  { id:"cannabis",  emoji:"🌿", label:"Cannabis" },
];

const getCyclePhase = (settings, dateStr) => {
  if(!settings.cycleTracking || !settings.cycleStartDate) return null;
  const start  = new Date(settings.cycleStartDate + "T00:00:00");
  const target = new Date(dateStr + "T00:00:00");
  const diff   = Math.floor((target - start) / 86400000);
  const cd     = settings.cycleDays || 28;
  const day    = ((diff % cd) + cd) % cd;
  if(day < 5)  return { label:"Menstruations",    emoji:"🔴", color:"#f87171", bg:"rgba(248,113,113,0.18)" };
  if(day < 13) return { label:"Phase folliculaire",emoji:"🌱", color:"#4ade80", bg:"rgba(74,222,128,0.18)" };
  if(day < 16) return { label:"Ovulation",         emoji:"🌕", color:"#fbbf24", bg:"rgba(251,191,36,0.18)" };
  return              { label:"Phase lutéale",     emoji:"🌙", color:"#a78bfa", bg:"rgba(167,139,250,0.18)" };
};

const getBg = (count, goal, dark) => {
  if(dark) return "linear-gradient(135deg,#0d1117,#161b22)";
  const r = goal>0 ? Math.min(count/goal,1) : 0;
  return `linear-gradient(135deg,rgb(${Math.round(180+r*70)},${Math.round(220-r*60)},${Math.round(180-r*60)}),rgb(${Math.round(160+r*80)},${Math.round(210-r*80)},${Math.round(200-r*80)}))`;
};

const FACTORS = [
  {id:"cafe",emoji:"☕",label:"Café"},{id:"stress",emoji:"😰",label:"Stress"},
  {id:"alcool",emoji:"🍺",label:"Alcool"},{id:"travail",emoji:"💼",label:"Travail"},
  {id:"ennui",emoji:"😴",label:"Ennui"},{id:"repas",emoji:"🍽️",label:"Repas"},
  {id:"social",emoji:"🎉",label:"Social"},{id:"sport",emoji:"🏃",label:"Sport"},
  {id:"ecran",emoji:"📱",label:"Écran"},{id:"pause",emoji:"⏸️",label:"Pause"},
  {id:"fatigue",emoji:"😓",label:"Fatigue"},{id:"motiv",emoji:"💪",label:"Motivation"},
  {id:"conduite",emoji:"🚗",label:"Conduite"},{id:"tel",emoji:"📞",label:"Téléphone"},
  {id:"colere",emoji:"😡",label:"Colère"},{id:"reveil",emoji:"⏰",label:"Réveil"},
  {id:"attente",emoji:"⏳",label:"Attente"},{id:"digestion",emoji:"🫃",label:"Digestion"},
  {id:"autre",emoji:"🔘",label:"Autre"},
];
const factorById = Object.fromEntries(FACTORS.map(f=>[f.id,f]));

const Icon = ({name,size=20,color="currentColor"}) => {
  const icons = {
    calendar:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    settings:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    target:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    user:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    coin:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2m-4-6h8"/></svg>,
    brain:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.07-4.6A3 3 0 1 1 9.5 2M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.07-4.6A3 3 0 1 0 14.5 2"/></svg>,
    download:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    home:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    plus:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
    chart:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-4"/></svg>,
    trophy:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>,
    savings: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10M12 6v6l4 2M18 2v4h4"/></svg>,
    zoomin:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
    zoomout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
    wallet:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>,
  };
  return icons[name]||null;
};

const StableInput = ({value,onCommit,type="text",min,max,placeholder="",style={}}) => {
  const [local,setLocal] = useState(String(value??''));
  const prev = useRef(value);
  useEffect(()=>{ if(prev.current!==value){setLocal(String(value??''));prev.current=value;} },[value]);
  return <input type={type} value={local} min={min} max={max} placeholder={placeholder}
    onChange={e=>setLocal(e.target.value)} onBlur={()=>{prev.current=local;onCommit(local);}} style={style}/>;
};

const Toggle = ({val,onChange,label,desc,dark}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.15)"}`}}>
    <div>
      <div style={{fontSize:14,color:dark?"#f0f4f2":"#5a3a30",fontWeight:600}}>{label}</div>
      {desc&&<div style={{fontSize:11,color:dark?"#90b8a8":"#a07868",marginTop:2}}>{desc}</div>}
    </div>
    <div onClick={()=>onChange(!val)} style={{width:48,height:26,borderRadius:99,background:val?"#4ade80":dark?"rgba(80,90,85,0.6)":"rgba(200,180,170,0.4)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0,marginLeft:12}}>
      <div style={{position:"absolute",top:3,left:val?22:3,width:20,height:20,borderRadius:"50%",background:"white",boxShadow:"0 1px 4px rgba(0,0,0,0.3)",transition:"left 0.2s"}}/>
    </div>
  </div>
);

const Card = ({children,style={},dark=false}) => (
  <div style={{
    background: dark?"rgba(255,255,255,0.09)":"rgba(255,255,255,0.65)",
    backdropFilter:"blur(12px)",borderRadius:20,padding:20,
    boxShadow: dark?"0 4px 24px rgba(0,0,0,0.5)":"0 4px 24px rgba(0,0,0,0.07)",
    border: dark?"1px solid rgba(255,255,255,0.13)":"1px solid rgba(255,255,255,0.8)",
    marginBottom:14,...style
  }}>{children}</div>
);

const Lbl = ({children,dark=false}) => (
  <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:dark?"#5ecfa0":"#a0857a",textTransform:"uppercase",marginBottom:10}}>{children}</div>
);

const EventModal = ({label,emoji,currentTime,onConfirm,onCancel}) => {
  const [time,setTime] = useState(currentTime||nowHHMM());
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:480}} onClick={e=>e.stopPropagation()}>
        <div style={{width:40,height:4,background:"rgba(200,180,170,0.5)",borderRadius:99,margin:"0 auto 20px"}}/>
        <div style={{fontSize:28,textAlign:"center",marginBottom:4}}>{emoji}</div>
        <div style={{fontSize:16,fontWeight:800,color:"#5a3a30",marginBottom:16,textAlign:"center"}}>{label}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:22}}>
          <span style={{fontSize:13,color:"#a07868"}}>Heure :</span>
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={{border:"1.5px solid rgba(200,180,170,0.4)",borderRadius:12,padding:"8px 16px",fontSize:20,color:"#5a4a40",outline:"none"}}/>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:12,borderRadius:14,border:"none",background:"rgba(200,180,170,0.2)",fontSize:14,fontWeight:600,color:"#a07868",cursor:"pointer"}}>Annuler</button>
          <button onClick={()=>onConfirm(time)} style={{flex:2,padding:12,borderRadius:14,border:"none",background:"linear-gradient(135deg,#86efac,#4ade80)",fontSize:15,fontWeight:700,color:"#1a4a30",cursor:"pointer"}}>✓ Confirmer</button>
        </div>
      </div>
    </div>
  );
};

const FactorModal = ({onConfirm,onCancel,settings}) => {
  const activeTypes = SMOKE_TYPES.filter(t=>(settings.smokeTypes||["cigarette"]).includes(t.id));
  const [smokeType,setSmokeType] = useState(activeTypes[0]?.id||"cigarette");
  const [selected,setSelected]   = useState(null);
  const [craving,setCraving]     = useState(null);
  const [customTime,setCustomTime] = useState(nowHHMM());
  const [useCustom,setUseCustom]   = useState(false);
  const cravingLabels = ["","Légère","Modérée","Forte","Très forte","Irrésistible"];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:40,height:4,background:"rgba(200,180,170,0.5)",borderRadius:99,margin:"0 auto 20px"}}/>
        <div style={{fontSize:16,fontWeight:800,color:"#5a3a30",marginBottom:4,textAlign:"center"}}>Nouvelle consommation</div>
        <div style={{fontSize:12,color:"#a07868",textAlign:"center",marginBottom:18}}>Analyse tes habitudes pour mieux les comprendre</div>

        {activeTypes.length>1&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#5a3a30",marginBottom:10}}>🛒 Que fumes-tu ?</div>
            <div style={{display:"flex",gap:8}}>
              {activeTypes.map(t=>(
                <button key={t.id} onClick={()=>setSmokeType(t.id)}
                  style={{flex:1,padding:"10px 6px",borderRadius:14,border:smokeType===t.id?"2.5px solid #fb7185":"2px solid rgba(200,180,170,0.3)",background:smokeType===t.id?"rgba(252,165,165,0.2)":"rgba(255,255,255,0.7)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <span style={{fontSize:24}}>{t.emoji}</span>
                  <span style={{fontSize:11,fontWeight:700,color:smokeType===t.id?"#c05040":"#a07868"}}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {settings.showCravings&&(
          <div style={{marginBottom:16,background:"rgba(196,181,253,0.15)",borderRadius:14,padding:"12px 14px"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#5a3a90",marginBottom:10}}>🌡️ Note d'envie</div>
            <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:6}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setCraving(craving===n?null:n)}
                  style={{width:46,height:46,borderRadius:12,border:"2px solid",borderColor:craving&&craving>=n?"#8b5cf6":"rgba(200,180,170,0.3)",background:craving&&craving>=n?"rgba(196,181,253,0.35)":"rgba(255,255,255,0.5)",fontSize:18,cursor:"pointer",fontWeight:700,color:craving&&craving>=n?"#6d28d9":"#a07868"}}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{textAlign:"center",fontSize:11,color:"#7a5a90",fontWeight:600,minHeight:16}}>{craving?cravingLabels[craving]:"Non renseigné"}</div>
          </div>
        )}

        {settings.showFactors&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#5a3a30",marginBottom:10}}>🔍 Facteur déclenchant <span style={{fontSize:11,fontWeight:400,color:"#a07868"}}>(optionnel)</span></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
              {FACTORS.map(f=>(
                <button key={f.id} onClick={()=>setSelected(selected===f.id?null:f.id)}
                  style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"9px 4px",borderRadius:14,border:selected===f.id?"2.5px solid #fb7185":"2px solid rgba(200,180,170,0.25)",background:selected===f.id?"rgba(252,165,165,0.2)":"rgba(255,255,255,0.7)",cursor:"pointer"}}>
                  <span style={{fontSize:20}}>{f.emoji}</span>
                  <span style={{fontSize:9,fontWeight:600,color:selected===f.id?"#c05040":"#a07868",textAlign:"center",lineHeight:1.2}}>{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{marginBottom:16,background:"rgba(253,230,138,0.2)",borderRadius:14,padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:useCustom?10:0}}>
            <span style={{fontSize:13,color:"#7a6030",fontWeight:600}}>⏰ Cigarette oubliée ?</span>
            <button onClick={()=>setUseCustom(u=>!u)} style={{background:useCustom?"rgba(253,230,138,0.6)":"rgba(255,255,255,0.7)",border:`1.5px solid ${useCustom?"#f59e0b":"rgba(200,180,170,0.3)"}`,borderRadius:99,padding:"4px 12px",fontSize:12,fontWeight:700,color:useCustom?"#7a6030":"#a07868",cursor:"pointer"}}>{useCustom?"✓ Activé":"Changer l'heure"}</button>
          </div>
          {useCustom&&<div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:"#a07868"}}>Heure réelle :</span>
            <input type="time" value={customTime} onChange={e=>setCustomTime(e.target.value)} style={{border:"1.5px solid rgba(200,180,170,0.4)",borderRadius:10,padding:"6px 10px",fontSize:15,color:"#5a4a40",outline:"none"}}/>
          </div>}
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:12,borderRadius:14,border:"none",background:"rgba(200,180,170,0.2)",fontSize:14,fontWeight:600,color:"#a07868",cursor:"pointer"}}>Annuler</button>
          <button onClick={()=>onConfirm(selected,useCustom?customTime:null,craving,smokeType)}
            style={{flex:2,padding:12,borderRadius:14,border:"none",background:"linear-gradient(135deg,#fca5a5,#fb7185)",fontSize:15,fontWeight:700,color:"white",cursor:"pointer"}}>
            {SMOKE_TYPES.find(t=>t.id===smokeType)?.emoji||"🚬"} Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

const TimelineBar = ({dayData,dark=false}) => {
  const [tip,setTip]   = useState(null);
  const [zoom,setZoom] = useState(1);
  const [off,setOff]   = useState(0);
  const wH=24/zoom, sH=Math.min(off,24-wH);
  const pct = t=>{ const m=msm(t); if(m===null)return null; const h=m/60; if(h<sH||h>sH+wH)return null; return((h-sH)/wH)*100; };
  const evs=[];
  if(dayData.wakeUp) evs.push({p:pct(dayData.wakeUp),c:"#86efac",l:"Lever",t:dayData.wakeUp,sz:14});
  if(dayData.lunch)  evs.push({p:pct(dayData.lunch), c:"#fcd34d",l:"Déjeuner",t:dayData.lunch,sz:14});
  if(dayData.dinner) evs.push({p:pct(dayData.dinner),c:"#fb923c",l:"Dîner",t:dayData.dinner,sz:14});
  if(dayData.bedtime)evs.push({p:pct(dayData.bedtime),c:"#c4b5fd",l:"Coucher",t:dayData.bedtime,sz:14});
  dayData.cigs.forEach((t,i)=>{ const p2=pct(t); if(p2===null)return; const fid=(dayData.cigFactors||{})[i]; const typ=(dayData.cigTypes||{})[i]||"cigarette"; const te=SMOKE_TYPES.find(x=>x.id===typ); evs.push({p:p2,c:"#fca5a5",l:`${te?.emoji||"🚬"} n°${i+1}${fid?` · ${factorById[fid]?.label}`:""}`,t,sz:11,cig:true}); });
  const ts=zoom===1?6:zoom===2?3:1; const ticks=[]; for(let h=Math.ceil(sH/ts)*ts;h<=sH+wH+0.01;h+=ts){if(h>=0&&h<=24)ticks.push(Math.round(h));}
  const pan=dir=>setOff(o=>Math.max(0,Math.min(24-wH,o+dir*(wH/3))));
  const tc=dark?"#90b8a8":"#a07868";
  return (
    <div style={{userSelect:"none"}}>
      <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
        {[["Lever","#86efac"],["Déjeuner","#fcd34d"],["Dîner","#fb923c"],["Coucher","#c4b5fd"],["Conso.","#fca5a5"]].map(([l,c])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:7,height:7,borderRadius:"50%",background:c}}/><span style={{fontSize:9,color:tc}}>{l}</span></div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:5,marginBottom:6}}>
        {zoom>1&&<button onClick={()=>pan(-1)} style={{background:dark?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.5)",border:"none",borderRadius:8,padding:"3px 8px",fontSize:13,cursor:"pointer",color:tc}}>◀</button>}
        <button onClick={()=>{if(zoom>1){setZoom(z=>z/2);if(zoom===2)setOff(0);}}} disabled={zoom===1} style={{background:dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.15)",border:"none",borderRadius:8,padding:"4px 8px",cursor:zoom>1?"pointer":"default",opacity:zoom===1?0.4:1}}><Icon name="zoomout" size={13} color={tc}/></button>
        <span style={{fontSize:10,color:tc,fontWeight:700,minWidth:28,textAlign:"center"}}>{zoom===1?"24h":zoom===2?"12h":"6h"}</span>
        <button onClick={()=>{if(zoom<4)setZoom(z=>z*2);}} disabled={zoom===4} style={{background:dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.15)",border:"none",borderRadius:8,padding:"4px 8px",cursor:zoom<4?"pointer":"default",opacity:zoom===4?0.4:1}}><Icon name="zoomin" size={13} color={tc}/></button>
        {zoom>1&&<button onClick={()=>pan(1)} style={{background:dark?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.5)",border:"none",borderRadius:8,padding:"3px 8px",fontSize:13,cursor:"pointer",color:tc}}>▶</button>}
      </div>
      <div style={{position:"relative",height:54}} onClick={()=>setTip(null)}>
        <div style={{position:"absolute",top:"50%",left:0,right:0,height:8,transform:"translateY(-50%)",background:dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.4)",borderRadius:99}}/>
        {ticks.map(h=><div key={h} style={{position:"absolute",left:`${((h-sH)/wH)*100}%`,top:"50%",transform:"translate(-50%,-50%)",width:1,height:18,background:dark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.1)"}}/>)}
        {tip&&<div style={{position:"absolute",bottom:"calc(100% + 6px)",left:`${Math.min(Math.max(tip.x,8),88)}%`,transform:"translateX(-50%)",background:dark?"rgba(15,22,30,0.97)":"rgba(70,40,30,0.93)",color:"white",borderRadius:10,padding:"5px 12px",fontSize:12,fontWeight:700,whiteSpace:"nowrap",zIndex:20,pointerEvents:"none"}}>{tip.l} · <span style={{fontFamily:"monospace"}}>{tip.t}</span></div>}
        {evs.map((ev,i)=>ev.p!==null&&<div key={i} onClick={e=>{e.stopPropagation();setTip(t=>t&&t.l+t.t===ev.l+ev.t?null:{...ev,x:ev.p});}} style={{position:"absolute",left:`${ev.p}%`,top:"50%",transform:"translate(-50%,-50%)",width:ev.sz,height:ev.sz,borderRadius:"50%",background:ev.c,border:`${ev.cig?1.5:2}px solid white`,boxShadow:"0 2px 6px rgba(0,0,0,0.2)",cursor:"pointer",zIndex:ev.cig?2:3}}/>)}
      </div>
      <div style={{position:"relative",height:14,marginTop:2}}>
        {ticks.map(h=><div key={h} style={{position:"absolute",left:`${((h-sH)/wH)*100}%`,transform:"translateX(-50%)",fontSize:9,color:dark?"#6a9a8a":"#bbb",fontFamily:"monospace"}}>{h}h</div>)}
      </div>
    </div>
  );
};

const LastCigChrono = ({cigs}) => {
  const [elapsed,setElapsed] = useState(0);
  const lastRef = useRef(null);
  if(cigs.length>0){const[h,m]=cigs[cigs.length-1].split(":").map(Number);const n=new Date();lastRef.current=new Date(n.getFullYear(),n.getMonth(),n.getDate(),h,m,0);}
  else lastRef.current=null;
  useEffect(()=>{ if(!lastRef.current)return; const tick=()=>setElapsed(Math.max(0,Math.floor((Date.now()-lastRef.current.getTime())/1000))); tick(); const id=setInterval(tick,60000); return()=>clearInterval(id); },[cigs.length>0?cigs[cigs.length-1]:null]);
  if(!cigs.length)return(<div style={{display:"flex",justifyContent:"center",margin:"14px 0 4px"}}><div style={{background:"rgba(134,239,172,0.25)",borderRadius:99,padding:"8px 20px",display:"inline-flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:"#86efac"}}/><span style={{fontSize:13,fontWeight:700,color:"#3a7a50"}}>Aucune consommation aujourd'hui 🌿</span></div></div>);
  const h=Math.floor(elapsed/3600),m=Math.floor((elapsed%3600)/60);
  const urg=elapsed<1800?"#f87171":elapsed<3600?"#fbbf24":"#4ade80";
  return(<div style={{display:"flex",justifyContent:"center",margin:"14px 0 4px"}}><div style={{background:elapsed<1800?"rgba(248,113,113,0.12)":elapsed<3600?"rgba(251,191,36,0.12)":"rgba(74,222,128,0.12)",borderRadius:99,padding:"10px 24px",display:"inline-flex",alignItems:"center",gap:12,border:`1.5px solid ${urg}40`}}><div style={{width:8,height:8,borderRadius:"50%",background:urg}}/><div><div style={{fontSize:10,fontWeight:700,color:"#a0857a",textTransform:"uppercase",marginBottom:1}}>Depuis la dernière</div><div style={{fontSize:26,fontWeight:900,color:urg,fontFamily:"monospace",lineHeight:1}}>{h>0?`${h}h ${String(m).padStart(2,"0")}m`:`${m}m`}</div></div></div></div>);
};

const usePeriodFilter = (data) => {
  const [period,setPeriodRaw] = useState("week");
  const [cs,setCS] = useState(""); const [ce,setCE] = useState(""); const [showR,setShowR] = useState(false);
  const setPeriod = v=>{ setPeriodRaw(v); setShowR(v==="custom"); };
  const allKeys = Object.keys(data).sort();
  let keys;
  if(period==="today") keys=[today()].filter(k=>data[k]);
  else if(period==="custom") keys=allKeys.filter(k=>cs&&ce&&k>=cs&&k<=ce);
  else{ const now=new Date(),cut=new Date(now); if(period==="week")cut.setDate(now.getDate()-7); else cut.setDate(now.getDate()-30); keys=allKeys.filter(k=>k>=cut.toISOString().slice(0,10)); }
  const PeriodBar = ({showToday=true}) => {
    const btn=(v,l)=><button onClick={()=>setPeriod(v)} style={{background:period===v?"rgba(200,130,110,0.4)":"rgba(255,255,255,0.4)",border:period===v?"2px solid rgba(200,130,110,0.6)":"2px solid transparent",borderRadius:99,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",color:"#5a3a30"}}>{l}</button>;
    return(<div style={{marginBottom:8}}><div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap",marginBottom:6}}>{showToday&&btn("today","Aujourd'hui")}{btn("week","7 jours")}{btn("month","30 jours")}{btn("custom","📅 Période")}</div>{showR&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"center",marginTop:6}}><input type="date" defaultValue={cs} max={today()} onChange={e=>setCS(e.target.value)} style={{border:"1.5px solid rgba(200,180,170,0.4)",background:"rgba(255,255,255,0.85)",borderRadius:10,padding:"7px 10px",fontSize:13,color:"#5a4a40",outline:"none"}}/><span style={{color:"#a07868",fontWeight:700}}>→</span><input type="date" defaultValue={ce} max={today()} onChange={e=>setCE(e.target.value)} style={{border:"1.5px solid rgba(200,180,170,0.4)",background:"rgba(255,255,255,0.85)",borderRadius:10,padding:"7px 10px",fontSize:13,color:"#5a4a40",outline:"none"}}/><button onClick={()=>{setCS(cs);setCE(ce);setShowR(false);}} style={{background:"linear-gradient(135deg,#fca5a5,#fb7185)",border:"none",borderRadius:10,padding:"8px 18px",fontSize:13,fontWeight:700,color:"white",cursor:"pointer"}}>OK</button></div>}</div>);
  };
  return {period,keys,PeriodBar};
};

// ══ DRAG SORTER ═══════════════════════════════════════════════════════════════




const BADGES = [
  {id:"first",   cat:"🚀 Premiers pas", emoji:"👣",label:"Premier pas",     check:d=>Object.keys(d).length>=1},
  {id:"week1",   cat:"🚀 Premiers pas", emoji:"📅",label:"7 jours trackés", check:d=>Object.keys(d).length>=7},
  {id:"streak3", cat:"🔥 Séries",       emoji:"🌱",label:"3 jours maîtrisés",check:d=>{let s=0;for(const k of Object.keys(d).sort().reverse()){const v=d[k];if(v&&v.cigs.length<=v.goal)s++;else break;}return s>=3;}},
  {id:"streak7", cat:"🔥 Séries",       emoji:"🌿",label:"Une semaine !",   check:d=>{let s=0;for(const k of Object.keys(d).sort().reverse()){const v=d[k];if(v&&v.cigs.length<=v.goal)s++;else break;}return s>=7;}},
  {id:"halfgoal",cat:"📉 Réduction",    emoji:"🎯",label:"Mi-objectif",    check:d=>Object.values(d).some(v=>v.cigs.length>0&&v.cigs.length<=(v.goal||10)/2)},
  {id:"zero",    cat:"📉 Réduction",    emoji:"🚭",label:"Journée zéro",   check:d=>Object.values(d).some(v=>v.cigs.length===0&&(v.wakeUp||v.note))},
  {id:"analyst", cat:"🔬 Analyse",      emoji:"🔬",label:"Analyste",       check:d=>{let n=0;Object.values(d).forEach(v=>n+=Object.values(v.cigFactors||{}).filter(Boolean).length);return n>=10;}},
  {id:"total50", cat:"📊 Volume",       emoji:"🔢",label:"50 trackées",    check:d=>Object.values(d).reduce((s,v)=>s+(v.cigs?.length||0),0)>=50},
];
const BADGE_CATS = [...new Set(BADGES.map(b=>b.cat))];

// ══ HOME ══════════════════════════════════════════════════════════════════════
const HomeTab = ({data,setData,settings,setSettings,expenses}) => {
  const [showModal,setShowModal]   = useState(false);
  const [eventModal,setEventModal] = useState(null);
  const dark = settings.darkMode||false;
  const dk2  = today(); const day = data[dk2]||defDay();
  const upd  = p=>{ const n={...data,[dk2]:{...(data[dk2]||defDay()),...p}}; setData(n); saveData(n); };
  const [newBadge,setNewBadge] = useState(null);
  const prevU = useRef(new Set(BADGES.filter(b=>b.check(data)).map(b=>b.id)));
  useEffect(()=>{ const now=new Set(BADGES.filter(b=>b.check(data)).map(b=>b.id)); for(const id of now){if(!prevU.current.has(id)){const b=BADGES.find(x=>x.id===id);setNewBadge(b);prevU.current.add(id);setTimeout(()=>setNewBadge(null),4000);break;}} },[data]);

  const confirmCig = (factorId,customTime,craving,smokeType) => {
    const t=customTime||nowHHMM(); const newCigs=[...day.cigs,t].sort(); const idx=newCigs.lastIndexOf(t);
    const oF={...(day.cigFactors||{})},oC={...(day.cigCravings||{})},oT={...(day.cigTypes||{})};
    const nF={},nC={},nT={}; let oi=0;
    newCigs.forEach((_,ni)=>{ if(ni===idx){if(factorId)nF[ni]=factorId;if(craving)nC[ni]=craving;nT[ni]=smokeType||"cigarette";}else{if(oF[oi]!==undefined)nF[ni]=oF[oi];if(oC[oi]!==undefined)nC[ni]=oC[oi];if(oT[oi]!==undefined)nT[ni]=oT[oi];oi++;} });
    upd({cigs:newCigs,cigFactors:nF,cigCravings:nC,cigTypes:nT}); setShowModal(false);
  };
  const remCig = i=>{ const nc=day.cigs.filter((_,j)=>j!==i); const nF={},nC={},nT={}; nc.forEach((_,ni)=>{const oi=ni>=i?ni+1:ni;if((day.cigFactors||{})[oi])nF[ni]=(day.cigFactors||{})[oi];if((day.cigCravings||{})[oi])nC[ni]=(day.cigCravings||{})[oi];if((day.cigTypes||{})[oi])nT[ni]=(day.cigTypes||{})[oi];}); upd({cigs:nc,cigFactors:nF,cigCravings:nC,cigTypes:nT}); };

  const ratio = day.goal>0?Math.min(day.cigs.length/day.goal,1):0;
  const cpCig = settings.pricePerPack/settings.cigsPerPack;
  const tC=dark?"#f0f4f2":"#5a3a30", stC=dark?"#90b8a8":"#a07868";
  const EVENTS=[{key:"wakeUp",label:"Lever",emoji:"☀️"},{key:"lunch",label:"Déjeuner",emoji:"🍽️"},{key:"dinner",label:"Dîner",emoji:"🌙"},{key:"bedtime",label:"Coucher",emoji:"😴"}];
  const phase = getCyclePhase(settings,dk2);
  const todayExp = expenses.filter(e=>e.date===dk2);
  const todayExpTotal = todayExp.reduce((s,e)=>s+e.amount,0);

  const layout = (settings.layouts||DEF_LAYOUTS).home || DEF_LAYOUTS.home;
  const counterCard = (
    <Card key="counter" dark={dark} style={{textAlign:"center",padding:"24px 20px"}}>
      {settings.name&&<div style={{fontSize:13,color:stC,marginBottom:2}}>Bonjour {settings.name} 👋</div>}
      <div style={{fontSize:11,fontWeight:700,color:stC,textTransform:"uppercase",marginBottom:4}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
      <div style={{fontSize:80,fontWeight:900,lineHeight:1,color:tC,margin:"8px 0"}}>{day.cigs.length}</div>
      <div style={{fontSize:14,color:stC}}>consommation{day.cigs.length!==1?"s":""}</div>
      <LastCigChrono cigs={day.cigs}/>
      <div style={{margin:"14px 0 6px",background:dark?"rgba(255,255,255,0.12)":"rgba(200,170,160,0.2)",borderRadius:99,height:10,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${ratio*100}%`,background:ratio<0.7?"#86efac":ratio<1?"#fcd34d":"#fca5a5",borderRadius:99,transition:"width 0.5s"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:stC,marginBottom:18}}>
        <span>{Math.max(0,day.goal-day.cigs.length)>0?`Encore ${day.goal-day.cigs.length} avant l'objectif`:`⚠️ Dépassé de ${day.cigs.length-day.goal}`}</span>
        <span>~{(day.cigs.length*cpCig).toFixed(2)}{settings.currency}</span>
      </div>
      <button onClick={()=>setShowModal(true)} style={{background:"linear-gradient(135deg,#fca5a5,#fb7185)",border:"none",borderRadius:999,padding:"14px 40px",fontSize:16,fontWeight:700,color:"white",cursor:"pointer",boxShadow:"0 6px 20px rgba(251,113,133,0.35)",display:"inline-flex",alignItems:"center",gap:10}}>
        <Icon name="plus" size={20} color="white"/> Consommer
      </button>
      {settings.showEvents&&<div style={{marginTop:12,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
        {EVENTS.map(ev=>{const set=!!day[ev.key];return<button key={ev.key} onClick={()=>{if(!day[ev.key])upd({[ev.key]:nowHHMM()});else setEventModal(ev);}} style={{background:set?(dark?"rgba(134,239,172,0.18)":"rgba(134,239,172,0.3)"):(dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.5)"),border:`1.5px solid ${set?"rgba(134,239,172,0.7)":(dark?"rgba(255,255,255,0.15)":"rgba(200,180,170,0.4)")}`,borderRadius:12,padding:"8px 4px",fontSize:11,fontWeight:700,color:set?"#2a6a40":stC,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><span style={{fontSize:18}}>{ev.emoji}</span><span>{set?day[ev.key]:ev.label}</span></button>;})}
      </div>}
    </Card>
  );
  const timelineCard = <Card key="timeline" dark={dark}><Lbl dark={dark}>Timeline du jour</Lbl><TimelineBar dayData={day} dark={dark}/></Card>;
  const cigsCard = (
    <Card key="cigs" dark={dark}>
      <Lbl dark={dark}>Consommations ({day.cigs.length})</Lbl>
      {day.cigs.length===0?<div style={{color:dark?"#5a8a78":"#c4a882",fontSize:14,textAlign:"center",padding:"12px 0"}}>Aucune consommation pour l'instant 🌿</div>
      :<div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {day.cigs.map((t,i)=>{ const fid=(day.cigFactors||{})[i]; const f=fid?factorById[fid]:null; const cr=(day.cigCravings||{})[i]; const typ=(day.cigTypes||{})[i]||"cigarette"; const te=SMOKE_TYPES.find(x=>x.id===typ);
          return<div key={i} style={{display:"flex",alignItems:"center",gap:6,background:dark?"rgba(252,165,165,0.14)":"rgba(252,165,165,0.25)",borderRadius:99,padding:"6px 12px",fontSize:13,color:dark?"#f0c0b8":"#8a3a30"}}>
            <span>{te?.emoji||"🚬"}</span>{t}{f&&<span style={{fontSize:11}}>{f.emoji}</span>}
            {cr&&settings.showCravings&&<span style={{fontSize:10,background:"rgba(196,181,253,0.4)",borderRadius:99,padding:"1px 6px",color:"#5a3a90",fontWeight:700}}>{cr}/5</span>}
            <button onClick={()=>remCig(i)} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><Icon name="trash" size={13} color="#f87171"/></button>
          </div>;})}
      </div>}
    </Card>
  );
  const cardMap = {counter:counterCard, timeline:timelineCard, cigs:cigsCard};

  return (
    <div>
      {showModal&&<FactorModal onConfirm={confirmCig} onCancel={()=>setShowModal(false)} settings={settings}/>}
      {eventModal&&<EventModal label={eventModal.label} emoji={eventModal.emoji} currentTime={day[eventModal.key]} onConfirm={t=>{upd({[eventModal.key]:t});setEventModal(null);}} onCancel={()=>setEventModal(null)}/>}
      {newBadge&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:200,background:"linear-gradient(135deg,rgba(253,230,138,0.97),rgba(252,200,100,0.97))",borderRadius:16,padding:"12px 20px",display:"flex",alignItems:"center",gap:12,maxWidth:340,width:"90%",border:"1.5px solid rgba(252,200,100,0.6)"}}><span style={{fontSize:32}}>{newBadge.emoji}</span><div><div style={{fontSize:11,fontWeight:700,color:"#7a5a20",textTransform:"uppercase"}}>Badge débloqué !</div><div style={{fontSize:14,fontWeight:800,color:"#5a3a10"}}>{newBadge.label}</div></div></div>}
      {phase&&<div style={{background:phase.bg,borderRadius:16,padding:"10px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10,border:`1.5px solid ${phase.color}50`}}><span style={{fontSize:22}}>{phase.emoji}</span><div><div style={{fontSize:11,fontWeight:700,color:phase.color,textTransform:"uppercase"}}>Cycle utérin</div><div style={{fontSize:13,fontWeight:600,color:tC}}>{phase.label}</div></div></div>}


      {layout.map(id=>cardMap[id]||null)}
    </div>
  );
};

// ══ CALENDAR ══════════════════════════════════════════════════════════════════
const CalendarTab = ({data,setData,settings,expenses}) => {
  const dark = settings.darkMode||false;
  const [sel,setSel]             = useState(today());
  const [cal,setCal]             = useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
  const [editNote,setEditNote]   = useState(false);
  const [addCigOpen,setAddCig]   = useState(false);
  const [cigTime,setCigTime]     = useState("12:00");
  const [showExpDetail,setShowExpDetail] = useState(false);
  const dim=(new Date(cal.y,cal.m+1,0).getDate()), fd=((new Date(cal.y,cal.m,1).getDay()+6)%7);
  const day=data[sel]||defDay();
  const updDay=p=>{const n={...data,[sel]:{...(data[sel]||defDay()),...p}};setData(n);saveData(n);};
  const addCig=()=>{const d=data[sel]||defDay();const nc=[...d.cigs,cigTime].sort();const n={...data,[sel]:{...d,cigs:nc}};setData(n);saveData(n);setAddCig(false);};
  const tC=dark?"#f0f4f2":"#5a3a30", stC=dark?"#90b8a8":"#a07868";
  const phase=getCyclePhase(settings,sel);
  const selExp=expenses.filter(e=>e.date===sel);
  const selExpTotal=selExp.reduce((s,e)=>s+e.amount,0);

  return (
    <div>
      <Card dark={dark}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <button onClick={()=>setCal(p=>{const d=new Date(p.y,p.m-1);return{y:d.getFullYear(),m:d.getMonth()};})} style={{background:dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)",border:"none",borderRadius:10,padding:"6px 14px",cursor:"pointer",fontSize:18,color:dark?"#c0d8d0":"#b08070"}}>‹</button>
          <span style={{fontWeight:700,fontSize:15,color:tC,textTransform:"capitalize"}}>{new Date(cal.y,cal.m,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</span>
          <button onClick={()=>setCal(p=>{const d=new Date(p.y,p.m+1);return{y:d.getFullYear(),m:d.getMonth()};})} style={{background:dark?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.7)",border:"none",borderRadius:10,padding:"6px 14px",cursor:"pointer",fontSize:18,color:dark?"#c0d8d0":"#b08070"}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,textAlign:"center"}}>
          {["Lu","Ma","Me","Je","Ve","Sa","Di"].map(d=><div key={d} style={{fontSize:11,fontWeight:700,color:dark?"#6a9a8a":"#c4a882",padding:"4px 0"}}>{d}</div>)}
          {Array.from({length:fd}).map((_,i)=><div key={"e"+i}/>)}
          {Array.from({length:dim}).map((_,i)=>{
            const n=i+1, k=`${cal.y}-${String(cal.m+1).padStart(2,"0")}-${String(n).padStart(2,"0")}`;
            const d=data[k], cnt=d?.cigs?.length||0, g=d?.goal||10, r=g>0?Math.min(cnt/g,1):0;
            const isT=k===today(), isS=k===sel;
            const hasExp=expenses.some(e=>e.date===k);
            const ph=getCyclePhase(settings,k);
            const bg=dark?(cnt>0?`rgba(${Math.round(70+r*80)},${Math.round(160-r*60)},${Math.round(120-r*40)},0.55)`:"rgba(255,255,255,0.05)"):(cnt>0?`rgba(${Math.round(180+r*70)},${Math.round(220-r*60)},${Math.round(180-r*60)},0.65)`:"rgba(255,255,255,0.4)");
            return<div key={k} onClick={()=>{setSel(k);setEditNote(false);setAddCig(false);setShowExpDetail(false);}} style={{borderRadius:10,padding:"4px 2px",cursor:"pointer",background:isS?(dark?"rgba(200,140,120,0.25)":"rgba(200,140,120,0.35)"):bg,border:isT?"2px solid #fb7185":isS?"2px solid #c4a882":ph?`2px solid ${ph.color}40`:"2px solid transparent",minHeight:46,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
              <div style={{fontSize:11,fontWeight:isT?800:600,color:dark?"#b0d0c8":"#8a6a60"}}>{n}</div>
              {cnt>0&&<div style={{fontSize:16,fontWeight:900,color:dark?"#f0d0c8":"#5a3a30"}}>{cnt}</div>}
              <div style={{display:"flex",gap:2,flexWrap:"wrap",justifyContent:"center"}}>
                {d?.note&&<span style={{fontSize:7}}>📝</span>}
                {hasExp&&<span style={{fontSize:8,fontWeight:800,color:dark?"#e0c060":"#9a7020"}}>€</span>}
                {ph&&<span style={{fontSize:7}}>{ph.emoji}</span>}
              </div>
            </div>;
          })}
        </div>
      </Card>

      <Card dark={dark}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <Lbl dark={dark}>{fmtShort(sel)}</Lbl>
            {sel===today()&&<span style={{fontSize:11,background:"rgba(251,113,133,0.15)",borderRadius:99,padding:"2px 8px",color:"#d05a60",fontWeight:600}}>Aujourd'hui</span>}
            {phase&&<span style={{fontSize:11,background:phase.bg,borderRadius:99,padding:"2px 8px",color:phase.color,fontWeight:600,marginLeft:4}}>{phase.emoji} {phase.label}</span>}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{setAddCig(a=>!a);setEditNote(false);setShowExpDetail(false);}} style={{background:dark?"rgba(252,165,165,0.18)":"rgba(252,165,165,0.3)",border:"none",borderRadius:10,padding:"5px 10px",cursor:"pointer",fontSize:12,color:dark?"#f0a898":"#c05040",fontWeight:700}}>+ Cig</button>
            {selExp.length>0&&<button onClick={()=>{setShowExpDetail(e=>!e);setEditNote(false);setAddCig(false);}} style={{background:dark?"rgba(253,230,138,0.15)":"rgba(253,230,138,0.4)",border:"none",borderRadius:10,padding:"5px 10px",cursor:"pointer",fontSize:12,color:dark?"#e0c060":"#7a6030",fontWeight:700}}>💸 {selExpTotal.toFixed(0)}{settings.currency}</button>}
            <button onClick={()=>{setEditNote(e=>!e);setAddCig(false);setShowExpDetail(false);}} style={{background:dark?"rgba(253,230,138,0.15)":"rgba(253,230,138,0.4)",border:"none",borderRadius:10,padding:"5px 10px",cursor:"pointer",fontSize:12,color:dark?"#e0c060":"#7a6030",fontWeight:600}}>{editNote?"✓":"📝"}</button>
          </div>
        </div>

        {addCigOpen&&<div style={{marginBottom:14,background:dark?"rgba(252,165,165,0.08)":"rgba(252,165,165,0.12)",borderRadius:14,padding:"12px 14px",border:"1.5px solid rgba(252,165,165,0.3)"}}>
          <div style={{fontSize:13,fontWeight:700,color:dark?"#f0a898":"#c05040",marginBottom:10}}>Ajouter une consommation</div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}><input type="time" value={cigTime} onChange={e=>setCigTime(e.target.value)} style={{border:`1.5px solid ${dark?"rgba(255,255,255,0.2)":"rgba(200,180,170,0.4)"}`,background:dark?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.85)",borderRadius:10,padding:"6px 10px",fontSize:16,color:dark?"#f0f4f2":"#5a4a40",outline:"none",flex:1}}/><button onClick={addCig} style={{background:"linear-gradient(135deg,#fca5a5,#fb7185)",border:"none",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700,color:"white",cursor:"pointer"}}>Ajouter</button></div>
        </div>}

        {showExpDetail&&selExp.length>0&&<div style={{marginBottom:14,background:dark?"rgba(253,230,138,0.08)":"rgba(253,230,138,0.2)",borderRadius:14,padding:"12px 14px",border:`1px solid ${dark?"rgba(253,230,138,0.15)":"rgba(253,230,138,0.5)"}`}}>
          <div style={{fontSize:12,fontWeight:700,color:dark?"#e0c060":"#7a6030",marginBottom:8}}>💸 Dépenses — {selExpTotal.toFixed(2)}{settings.currency}</div>
          {selExp.map((e,i)=>{const c=EXPENSE_CATS.find(x=>x.id===e.cat);return<div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:dark?"#c0b070":"#8a7040",padding:"3px 0"}}><span>{c?.emoji} {c?.label}{e.note?` · ${e.note}`:""}</span><span style={{fontWeight:700}}>{e.amount.toFixed(2)}{settings.currency}</span></div>;})}
        </div>}

        {editNote&&<textarea value={day.note||""} onChange={e=>updDay({note:e.target.value})} placeholder="Note du jour…" style={{width:"100%",background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.7)",border:`1.5px solid ${dark?"rgba(255,255,255,0.15)":"rgba(200,180,170,0.3)"}`,borderRadius:12,padding:12,fontSize:14,color:dark?"#f0f4f2":"#5a4a40",outline:"none",resize:"none",minHeight:72,boxSizing:"border-box",marginBottom:14}}/>}
        <TimelineBar dayData={day} dark={dark}/>
      </Card>
    </div>
  );
};

// ══ STATS ═════════════════════════════════════════════════════════════════════
const StatsTab = ({data,settings,setSettings,expenses}) => {
  const dark = settings.darkMode||false;
  const {period,keys,PeriodBar} = usePeriodFilter(data);
  const allKeys = Object.keys(data).sort();
  const days = keys.map(k=>data[k]).filter(Boolean);
  const keyedDays = keys.filter(k=>data[k]).map(k=>({k,d:data[k]}));
  const total = days.reduce((s,d)=>s+d.cigs.length,0);
  const avg   = days.length?(total/days.length).toFixed(1):0;
  const maxD  = days.reduce((m,d)=>Math.max(m,d.cigs.length),0);
  const sorted=[...days].filter(d=>d.cigs.length>0).map(d=>d.cigs.length).sort((a,b)=>a-b);
  const median=sorted.length?sorted[Math.floor(sorted.length/2)]:null;
  const gr=days.filter(d=>d.cigs.length<=d.goal).length;
  const grP=days.length?Math.round((gr/days.length)*100):0;
  const streak=(()=>{let s=0;for(const k of[...allKeys].reverse()){const d=data[k];if(d&&d.cigs.length<=d.goal)s++;else break;}return s;})();
  const cpCig=settings.pricePerPack/settings.cigsPerPack;
  const estCost=(total*cpCig).toFixed(2);
  const ps=keys[0]||today(), pe=keys[keys.length-1]||today();
  const realExp=expenses.filter(e=>e.date>=ps&&e.date<=pe);
  const realExpTotal=realExp.reduce((s,e)=>s+e.amount,0);

  const typeStats={};
  days.forEach(d=>{const types=d.cigTypes||{};d.cigs.forEach((_,i)=>{const t=types[i]||"cigarette";typeStats[t]=(typeStats[t]||0)+1;});});

  const hc=Array(24).fill(0);
  days.forEach(d=>d.cigs.forEach(t=>{const m=msm(t);if(m!==null)hc[Math.floor(m/60)]++;}));
  const mxH=Math.max(...hc,1), pkH=hc.indexOf(Math.max(...hc));

  // ── Intervalle moyen entre cigs ──
  const allIntervals=[];
  days.forEach(d=>{
    const times=d.cigs.map(t=>msm(t)).filter(x=>x!==null).sort((a,b)=>a-b);
    for(let i=1;i<times.length;i++) allIntervals.push(times[i]-times[i-1]);
  });
  const avgInterval=allIntervals.length?Math.round(allIntervals.reduce((a,b)=>a+b,0)/allIntervals.length):null;
  const minInterval=allIntervals.length?Math.min(...allIntervals):null;
  const maxInterval=allIntervals.length?Math.max(...allIntervals):null;

  // ── Courbe d'évolution (max 30 points) ──
  const chartKeys = keyedDays.slice(-30);
  const chartMax = Math.max(...chartKeys.map(x=>x.d.cigs.length),1);

  // ── Répartition par moment de la journée ──
  const slots={matin:0,apresmidi:0,soir:0,nuit:0};
  days.forEach(d=>d.cigs.forEach(t=>{const m=msm(t);if(m===null)return;const h=m/60;if(h>=6&&h<12)slots.matin++;else if(h>=12&&h<18)slots.apresmidi++;else if(h>=18&&h<23)slots.soir++;else slots.nuit++;}));
  const slotTotal=Object.values(slots).reduce((a,b)=>a+b,0)||1;
  const slotDefs=[{k:"matin",l:"Matin",e:"🌅",h:"6h–12h"},{k:"apresmidi",l:"Après-midi",e:"☀️",h:"12h–18h"},{k:"soir",l:"Soir",e:"🌆",h:"18h–23h"},{k:"nuit",l:"Nuit",e:"🌙",h:"23h–6h"}];

  // ── Jour de la semaine ──
  const dowCounts=Array(7).fill(0); const dowLabels=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  keyedDays.forEach(({k,d})=>{const dow=(new Date(k+"T12:00:00").getDay()+6)%7;dowCounts[dow]+=d.cigs.length;});
  const dowDays=Array(7).fill(0);
  keyedDays.forEach(({k})=>{const dow=(new Date(k+"T12:00:00").getDay()+6)%7;dowDays[dow]++;});
  const dowAvg=dowCounts.map((c,i)=>dowDays[i]>0?+(c/dowDays[i]).toFixed(1):0);
  const maxDow=Math.max(...dowAvg,1);
  const peakDow=dowAvg.indexOf(Math.max(...dowAvg));

  // ── Lien lever/coucher et conso ──
  const sleepStats={short:[],normal:[],long:[]};
  keyedDays.forEach(({k,d})=>{
    const w=msm(d.wakeUp), b=msm(d.bedtime);
    if(w===null||b===null)return;
    const awake=b>w?b-w:b+1440-w;
    const bucket=awake<480?"short":awake<720?"normal":"long";
    sleepStats[bucket].push(d.cigs.length);
  });
  const sleepAvg=obj=>{const v=Object.values(obj);return v.length?+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):null;};

  // ── Délai avant 1ère cig après événement ──
  const eventDelays={wakeUp:[],lunch:[],dinner:[]};
  const eventLabels={wakeUp:{label:"Lever",emoji:"☀️"},lunch:{label:"Déjeuner",emoji:"🍽️"},dinner:{label:"Dîner",emoji:"🌙"}};
  keyedDays.forEach(({d})=>{
    Object.keys(eventDelays).forEach(evKey=>{
      const evTime=msm(d[evKey]);
      if(evTime===null)return;
      const sorted=d.cigs.map(t=>msm(t)).filter(x=>x!==null&&x>evTime).sort((a,b)=>a-b);
      if(sorted.length>0) eventDelays[evKey].push(sorted[0]-evTime);
    });
  });
  const eventDelayStats=Object.fromEntries(
    Object.entries(eventDelays).map(([k,v])=>[k, v.length?{
      avg:Math.round(v.reduce((a,b)=>a+b,0)/v.length),
      min:Math.min(...v),
      max:Math.max(...v),
    }:null])
  );

  // ── Comparaison semaine N vs N-1 ──
  const getWeekKeys=(offsetWeeks)=>{
    const end=new Date(); end.setDate(end.getDate()-offsetWeeks*7);
    const start=new Date(end); start.setDate(end.getDate()-6);
    const s=start.toISOString().slice(0,10), e2=end.toISOString().slice(0,10);
    return allKeys.filter(k=>k>=s&&k<=e2);
  };
  const wkNkeys=getWeekKeys(0), wkN1keys=getWeekKeys(1);
  const wkN=wkNkeys.reduce((s,k)=>s+(data[k]?.cigs?.length||0),0);
  const wkN1=wkN1keys.reduce((s,k)=>s+(data[k]?.cigs?.length||0),0);
  const wkDiff=wkN-wkN1;
  const wkPct=wkN1>0?Math.round(((wkN-wkN1)/wkN1)*100):null;

  // ── Argent économisé vs habitude ──
  const habitCost=settings.usualCigs*cpCig;
  const daysCount=Math.max(days.length,1);
  const savedPerDay=Math.max(0,habitCost-(total/daysCount*cpCig));
  const savedTotal=(savedPerDay*daysCount).toFixed(2);
  const savedMonth=(savedPerDay*30).toFixed(2);
  const savedYear=(savedPerDay*365).toFixed(2);

  const tC=dark?"#f0f4f2":"#5a3a30", stC=dark?"#90b8a8":"#a07868";
  const SC=({l,v,e})=><div style={{background:dark?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.62)",borderRadius:14,padding:"12px 10px",textAlign:"center"}}>{e&&<div style={{fontSize:20}}>{e}</div>}<div style={{fontSize:18,fontWeight:900,color:tC,lineHeight:1.1}}>{v}</div><div style={{fontSize:10,color:stC,marginTop:2}}>{l}</div></div>;

  // ── Cards ──
  const layout = (settings.layouts||DEF_LAYOUTS).stats || DEF_LAYOUTS.stats;

  const summaryCard = <Card key="summary" dark={dark}><Lbl dark={dark}>Résumé</Lbl><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}><SC v={total} l="Total"/><SC v={period==="today"?total:avg} l={period==="today"?"Auj.":"Moy / jour"}/><SC v={maxD} l="Record"/><SC v={median??"–"} l="Médiane"/><SC v={`${grP}%`} l="Objectifs"/><SC v={`${streak}j`} l="Série"/></div></Card>;

  const costCard = <Card key="cost" dark={dark}><Lbl dark={dark}>💸 Coût de la période</Lbl><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:realExpTotal>0?12:0}}><div style={{background:dark?"rgba(252,165,165,0.12)":"rgba(252,165,165,0.2)",borderRadius:12,padding:10,textAlign:"center"}}><div style={{fontSize:11,color:stC,marginBottom:4}}>Estimé</div><div style={{fontSize:22,fontWeight:900,color:dark?"#f0a0a0":"#c05040"}}>{estCost}{settings.currency}</div></div><div style={{background:dark?"rgba(253,230,138,0.1)":"rgba(253,230,138,0.25)",borderRadius:12,padding:10,textAlign:"center"}}><div style={{fontSize:11,color:stC,marginBottom:4}}>Réel (dépenses)</div><div style={{fontSize:22,fontWeight:900,color:dark?"#e0c060":"#7a6030"}}>{realExpTotal>0?`${realExpTotal.toFixed(2)}${settings.currency}`:"–"}</div></div></div>{realExp.length>0&&<div style={{display:"flex",flexDirection:"column",gap:4}}>{EXPENSE_CATS.map(cat=>{const tot=realExp.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.amount,0);return tot>0&&<div key={cat.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:dark?"#c0c8c4":"#7a6a60",padding:"4px 0",borderBottom:`1px solid ${dark?"rgba(255,255,255,0.07)":"rgba(200,180,170,0.15)"}`}}><span>{cat.emoji} {cat.label}</span><span style={{fontWeight:700}}>{tot.toFixed(2)}{settings.currency}</span></div>;})}</div>}</Card>;

  const hoursCard = <Card key="hours" dark={dark}><Lbl dark={dark}>🕐 Distribution horaire</Lbl>{hc[pkH]>0&&<div style={{fontSize:12,color:stC,marginBottom:8}}>Pic : <strong style={{color:tC}}>{pkH}h–{pkH+1}h</strong></div>}<div style={{display:"flex",alignItems:"flex-end",gap:2,height:64}}>{hc.map((c,h)=><div key={h} style={{flex:1,height:`${Math.max((c/mxH)*56,c>0?3:0)}px`,background:h===pkH&&c>0?"#fb7185":c?`hsl(${20-(h/24)*30},65%,${dark?52:70}%)`:(dark?"rgba(255,255,255,0.07)":"rgba(200,180,170,0.15)"),borderRadius:"3px 3px 0 0",alignSelf:"flex-end"}}/>)}</div><div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:dark?"#6a9a8a":"#bbb",fontFamily:"monospace",marginTop:4}}>{[0,6,12,18,23].map(h=><span key={h}>{h}h</span>)}</div></Card>;

  // 📈 Courbe d'évolution
  const evolutionCard = chartKeys.length>=2 ? (
    <Card key="evolution" dark={dark}>
      <Lbl dark={dark}>📈 Évolution sur la période</Lbl>
      <div style={{position:"relative",height:80,display:"flex",alignItems:"flex-end",gap:2}}>
        {chartKeys.map(({k,d},i)=>{
          const h=Math.max((d.cigs.length/chartMax)*72,d.cigs.length>0?4:0);
          const overGoal=d.cigs.length>d.goal;
          const isToday=k===today();
          return <div key={k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:"100%",height:h,background:overGoal?(dark?"rgba(248,113,113,0.7)":"#fca5a5"):(dark?"rgba(74,222,128,0.55)":"#86efac"),borderRadius:"3px 3px 0 0",border:isToday?"1.5px solid #fb7185":"none",boxSizing:"border-box"}}/>
          </div>;
        })}
        {/* Objectif line */}
        {days[0]?.goal&&<div style={{position:"absolute",left:0,right:0,bottom:`${(days[0].goal/chartMax)*72}px`,borderTop:`1.5px dashed ${dark?"rgba(251,191,36,0.5)":"rgba(200,140,80,0.4)"}`,pointerEvents:"none"}}/>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:dark?"#6a9a8a":"#bbb",marginTop:4}}>
        <span>{chartKeys[0]?.k.slice(5)}</span>
        <span style={{fontSize:10,color:stC}}>— objectif</span>
        <span>{chartKeys[chartKeys.length-1]?.k.slice(5)}</span>
      </div>
      <div style={{display:"flex",gap:10,marginTop:8,justifyContent:"center"}}>
        {[["#86efac","Sous objectif",dark?"rgba(74,222,128,0.55)":"#86efac"],["#fca5a5","Dépassé",dark?"rgba(248,113,113,0.7)":"#fca5a5"]].map(([_,l,bg])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:2,background:bg}}/><span style={{fontSize:10,color:stC}}>{l}</span></div>
        ))}
      </div>
    </Card>
  ) : null;

  // ⏱ Intervalle moyen
  const intervalCard = avgInterval!==null ? (
    <Card key="interval" dark={dark}>
      <Lbl dark={dark}>⏱ Intervalles entre cigarettes</Lbl>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
        {[["Moyen",fmtDur(avgInterval),"#86efac"],["Min",fmtDur(minInterval),"#fca5a5"],["Max",fmtDur(maxInterval),"#c4b5fd"]].map(([l,v,c])=>(
          <div key={l} style={{background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.7)",borderRadius:12,padding:"10px 6px",textAlign:"center",border:`1.5px solid ${c}60`}}>
            <div style={{fontSize:15,fontWeight:900,color:tC}}>{v}</div>
            <div style={{fontSize:10,color:stC,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:stC,textAlign:"center"}}>
        {avgInterval<30?"⚠️ Rythme très rapide — essaie d'espacer davantage":avgInterval<60?"👍 Rythme modéré":"✅ Bon espacement entre les cigarettes"}
      </div>
    </Card>
  ) : null;

  // 📅 Jour de la semaine
  const dowCard = (
    <Card key="dow" dark={dark}>
      <Lbl dark={dark}>📅 Jour le plus chargé</Lbl>
      <div style={{fontSize:12,color:stC,marginBottom:8}}>Pic : <strong style={{color:tC}}>{dowLabels[peakDow]}</strong> ({dowAvg[peakDow]} moy.)</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height:56}}>
        {dowAvg.map((v,i)=>(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:"100%",height:`${Math.max((v/maxDow)*48,v>0?3:0)}px`,background:i===peakDow?"#fb7185":(dark?"rgba(255,255,255,0.2)":"rgba(200,140,120,0.35)"),borderRadius:"3px 3px 0 0",alignSelf:"flex-end"}}/>
            <div style={{fontSize:9,color:i===peakDow?(dark?"#f87171":"#c05040"):stC,fontWeight:i===peakDow?700:400}}>{dowLabels[i].slice(0,2)}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  // 😴 Lien lever/coucher
  const sleepCorrelCard = (()=>{
    const entries=[
      {k:"short",l:"Journée courte",e:"😴",desc:"< 8h éveillé",avg:sleepAvg(sleepStats.short),n:sleepStats.short.length},
      {k:"normal",l:"Journée normale",e:"🙂",desc:"8h–12h éveillé",avg:sleepAvg(sleepStats.normal),n:sleepStats.normal.length},
      {k:"long",l:"Longue journée",e:"⚡",desc:"> 12h éveillé",avg:sleepAvg(sleepStats.long),n:sleepStats.long.length},
    ].filter(e=>e.n>0);
    if(entries.length<2) return null;
    const maxAvg=Math.max(...entries.map(e=>e.avg||0),1);
    return (
      <Card key="sleep" dark={dark}>
        <Lbl dark={dark}>😴 Durée d'éveil et consommation</Lbl>
        <div style={{fontSize:11,color:stC,marginBottom:10}}>Basé sur tes heures de lever et coucher</div>
        {entries.map(e=>(
          <div key={e.k} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontSize:20,width:26}}>{e.e}</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:12,fontWeight:600,color:tC}}>{e.l}</span>
                <span style={{fontSize:12,fontWeight:800,color:stC}}>{e.avg} moy · {e.n}j</span>
              </div>
              <div style={{background:dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.2)",borderRadius:99,height:8,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${(e.avg/maxAvg)*100}%`,background:e.k==="long"?"#f87171":e.k==="short"?"#c4b5fd":"#86efac",borderRadius:99}}/>
              </div>
              <div style={{fontSize:10,color:dark?"#6a9a8a":"#b0a890",marginTop:2}}>{e.desc}</div>
            </div>
          </div>
        ))}
      </Card>
    );
  })();

  // 📆 Comparaison semaine N vs N-1
  const weekCompareCard = (
    <Card key="weekcompare" dark={dark}>
      <Lbl dark={dark}>📆 Cette semaine vs la semaine dernière</Lbl>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",marginBottom:14}}>
        <div style={{textAlign:"center",background:dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.7)",borderRadius:14,padding:"14px 8px"}}>
          <div style={{fontSize:11,color:stC,marginBottom:4}}>Sem. précédente</div>
          <div style={{fontSize:32,fontWeight:900,color:dark?"#c0d0c8":"#7a8a80"}}>{wkN1}</div>
          <div style={{fontSize:10,color:stC}}>cigarettes</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:wkDiff<0?"#4ade80":wkDiff>0?"#f87171":stC}}>{wkDiff>0?"+":""}{wkDiff}</div>
          <div style={{fontSize:10,color:stC}}>{wkPct!==null?`${wkDiff>0?"+":""}${wkPct}%`:"–"}</div>
        </div>
        <div style={{textAlign:"center",background:wkDiff<0?(dark?"rgba(74,222,128,0.12)":"rgba(134,239,172,0.2)"):wkDiff>0?(dark?"rgba(248,113,113,0.12)":"rgba(252,165,165,0.2)"):(dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.7)"),borderRadius:14,padding:"14px 8px",border:wkDiff<0?"1.5px solid rgba(74,222,128,0.35)":wkDiff>0?"1.5px solid rgba(248,113,113,0.35)":"none"}}>
          <div style={{fontSize:11,color:stC,marginBottom:4}}>Cette semaine</div>
          <div style={{fontSize:32,fontWeight:900,color:wkDiff<0?"#4ade80":wkDiff>0?"#f87171":tC}}>{wkN}</div>
          <div style={{fontSize:10,color:stC}}>cigarettes</div>
        </div>
      </div>
      <div style={{textAlign:"center",fontSize:12,fontWeight:600,color:wkDiff<0?"#4ade80":wkDiff>0?"#f87171":stC}}>
        {wkDiff<0?`🎉 ${Math.abs(wkDiff)} de moins — continue !`:wkDiff>0?`⚠️ ${wkDiff} de plus que la semaine dernière`:"= Même rythme que la semaine dernière"}
      </div>
    </Card>
  );

  // 💸 Argent économisé
  const savingsCard = parseFloat(savedTotal)>0 ? (
    <Card key="savings" dark={dark}>
      <Lbl dark={dark}>💰 Argent économisé vs ton habitude</Lbl>
      <div style={{textAlign:"center",padding:"10px 0 14px"}}>
        <div style={{fontSize:11,color:stC,marginBottom:4}}>Sur cette période</div>
        <div style={{fontSize:44,fontWeight:900,color:dark?"#4ade80":"#2a7a40",lineHeight:1}}>{savedTotal}{settings.currency}</div>
        <div style={{fontSize:11,color:stC,marginTop:4}}>économisés vs {settings.usualCigs} cig/j habituels</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[["/ mois",savedMonth,"rgba(134,239,172,0.2)","#2a6a40"],["/ an",savedYear,"rgba(74,222,128,0.15)","#1a5a30"]].map(([l,v,bg,c])=>(
          <div key={l} style={{background:dark?"rgba(74,222,128,0.1)":bg,borderRadius:12,padding:10,textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:900,color:dark?"#4ade80":c}}>{v}{settings.currency}</div>
            <div style={{fontSize:10,color:stC}}>{l} à ce rythme</div>
          </div>
        ))}
      </div>
    </Card>
  ) : null;

  // ⏱ Délai avant 1ère cig après événement
  const eventDelayCard = Object.values(eventDelayStats).some(v=>v!==null) ? (
    <Card key="eventdelay" dark={dark}>
      <Lbl dark={dark}>⏱ Délai avant la 1ère cig après…</Lbl>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {Object.entries(eventDelayStats).map(([key,val])=>{
          const ev=eventLabels[key];
          if(!val)return null;
          const color=val.avg<30?"#f87171":val.avg<60?"#fcd34d":val.avg<120?"#86efac":"#4ade80";
          const maxVal=Math.max(...Object.values(eventDelayStats).filter(Boolean).map(v=>v.avg),1);
          return(
            <div key={key}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:20}}>{ev.emoji}</span>
                <span style={{fontSize:13,fontWeight:700,color:tC}}>{ev.label}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {[["Moyen",val.avg,"#86efac"],["Min",val.min,"#fca5a5"],["Max",val.max,"#c4b5fd"]].map(([l,v,c])=>(
                  <div key={l} style={{background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.7)",borderRadius:10,padding:"8px 6px",textAlign:"center",border:`1.5px solid ${c}60`}}>
                    <div style={{fontSize:13,fontWeight:900,color:tC}}>{fmtDur(v)}</div>
                    <div style={{fontSize:9,color:stC,marginTop:2}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:6,background:dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.2)",borderRadius:99,height:6,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.round((val.avg/maxVal)*100)}%`,background:color,borderRadius:99}}/>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  ) : null;

  const DEF_STATS_LAYOUT = ["summary","evolution","weekcompare","interval","eventdelay","dow","sleep","hours"];
  const fullCardMap = {summary:summaryCard, hours:hoursCard, evolution:evolutionCard, interval:intervalCard, dow:dowCard, sleep:sleepCorrelCard, weekcompare:weekCompareCard, eventdelay:eventDelayCard};
  const storedLayout = (settings.layouts||DEF_LAYOUTS).stats;
  // merge any new cards not yet in stored layout
  const newIds = DEF_STATS_LAYOUT.filter(id=>!storedLayout?.includes(id));
  const mergedLayout = storedLayout ? [...storedLayout, ...newIds] : DEF_STATS_LAYOUT;

  return (
    <div>
      <PeriodBar showToday={true}/>

      {Object.keys(typeStats).length>1&&<Card dark={dark}><Lbl dark={dark}>🛒 Par type de produit</Lbl><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{Object.entries(typeStats).sort((a,b)=>b[1]-a[1]).map(([tid,cnt])=>{const t=SMOKE_TYPES.find(x=>x.id===tid);return<div key={tid} style={{flex:1,minWidth:80,background:dark?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.62)",borderRadius:14,padding:"12px 10px",textAlign:"center"}}><div style={{fontSize:28}}>{t?.emoji||"🚬"}</div><div style={{fontSize:20,fontWeight:900,color:tC}}>{cnt}</div><div style={{fontSize:11,color:stC}}>{t?.label||tid}</div></div>;})}</div></Card>}
      {mergedLayout.map(id=>fullCardMap[id]||null)}
    </div>
  );
};

// ══ PROGRESS ══════════════════════════════════════════════════════════════════
const ProgressTab = ({data,settings,setSettings}) => {
  const dark = settings.darkMode||false;
  const [heatTip,setHeatTip] = useState(null);
  const allKeys = Object.keys(data).sort();
  const now = new Date(); const heatStart = new Date(now); heatStart.setFullYear(now.getFullYear()-1); heatStart.setDate(heatStart.getDate()+1);
  const heatDays=[];
  for(let d=new Date(heatStart);d<=now;d.setDate(d.getDate()+1)){const k=d.toISOString().slice(0,10);const dd=data[k];const cnt=dd?.cigs?.length??-1;const goal=dd?.goal||settings.defaultGoal||10;heatDays.push({k,cnt,ratio:cnt<0?-1:goal>0?Math.min(cnt/goal,1):0});}
  const firstDow=(new Date(heatStart.toISOString().slice(0,10)+"T00:00:00").getDay()+6)%7;
  const padded=[...Array(firstDow).fill(null),...heatDays]; const weeks2=[];
  for(let i=0;i<padded.length;i+=7)weeks2.push(padded.slice(i,i+7));
  const heatColor=r=>{
    if(r<0)return dark?"rgba(255,255,255,0.05)":"rgba(200,180,170,0.12)";
    if(r===0)return dark?"rgba(74,222,128,0.25)":"#bbf7d0";
    return dark?`rgba(${Math.round(80+r*160)},${Math.round(180-r*100)},${Math.round(120-r*60)},0.8)`:`rgb(${Math.round(180+r*75)},${Math.round(230-r*90)},${Math.round(180-r*70)})`;
  };
  let streak=0; for(const k of[...allKeys].reverse()){const d=data[k];if(d&&d.cigs.length<=d.goal)streak++;else break;}
  const unlockedIds = new Set(BADGES.filter(b=>b.check(data)).map(b=>b.id));
  const stC=dark?"#90b8a8":"#a07868", tC=dark?"#f0f4f2":"#5a3a30";

  const heatmapCard = (
    <Card key="heatmap" dark={dark}><Lbl dark={dark}>🗓️ Heatmap — 12 mois</Lbl>
      <div style={{display:"flex",gap:1}}>
        <div style={{display:"flex",flexDirection:"column",gap:1,marginRight:2}}>{["L","M","M","J","V","S","D"].map((d,i)=><div key={i} style={{height:12,fontSize:7,color:stC,lineHeight:"12px",textAlign:"right",paddingRight:2}}>{i%2===0?d:""}</div>)}</div>
        <div style={{display:"flex",gap:1,overflowX:"auto",flex:1}} onClick={()=>setHeatTip(null)}>
          {weeks2.map((wk,wi)=><div key={wi} style={{display:"flex",flexDirection:"column",gap:1}}>{Array.from({length:7}).map((_,di)=>{const cell=wk[di];if(!cell)return<div key={di} style={{width:12,height:12}}/>;return<div key={di} onClick={e=>{e.stopPropagation();setHeatTip(t=>t===cell.k?null:cell.k);}} style={{width:12,height:12,borderRadius:2,background:heatColor(cell.ratio),cursor:"pointer",border:heatTip===cell.k?"1.5px solid rgba(251,113,133,0.8)":"1.5px solid transparent",boxSizing:"border-box"}}/>;})}</div>)}
        </div>
      </div>
      {heatTip&&(()=>{const dd=data[heatTip];const cnt=dd?.cigs?.length??0;return<div style={{marginTop:10,background:dark?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.8)",borderRadius:12,padding:"8px 14px",fontSize:13,color:tC,display:"flex",justifyContent:"space-between"}}><span>{new Date(heatTip+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</span><span style={{fontWeight:800}}>{dd?`${cnt} 🚬`:"Aucune donnée"}</span></div>;})()}
      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:8,justifyContent:"flex-end"}}><span style={{fontSize:9,color:stC}}>Moins</span>{[0,0.25,0.5,0.75,1].map(r=><div key={r} style={{width:10,height:10,borderRadius:2,background:heatColor(r)}}/>)}<span style={{fontSize:9,color:stC}}>Plus</span></div>
    </Card>
  );
  const streakCard = (
    <Card key="streak" dark={dark} style={{padding:"16px 20px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:11,fontWeight:700,color:stC,textTransform:"uppercase",marginBottom:4}}>🔥 Série en cours</div><div style={{fontSize:11,color:stC}}>Jours consécutifs sous objectif</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:48,fontWeight:900,color:streak>=7?"#f59e0b":streak>=3?"#4ade80":"#f87171",lineHeight:1}}>{streak}</div><div style={{fontSize:11,color:stC}}>jour{streak!==1?"s":""}</div></div>
      </div>
      {streak>0&&<><div style={{marginTop:10,background:dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.2)",borderRadius:99,height:8,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min((streak/30)*100,100)}%`,background:"linear-gradient(90deg,#86efac,#fcd34d,#fb923c)",borderRadius:99}}/></div><div style={{fontSize:10,color:stC,marginTop:4,textAlign:"right"}}>{streak}/30 vers 🏆</div></>}
    </Card>
  );
  const badgesCard = (
    <Card key="badges" dark={dark}><Lbl dark={dark}>🏅 Badges ({BADGES.filter(b=>unlockedIds.has(b.id)).length}/{BADGES.length})</Lbl>
      {BADGE_CATS.map(cat=>{const cb=BADGES.filter(b=>b.cat===cat);return<div key={cat} style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:700,color:stC,textTransform:"uppercase",marginBottom:8}}>{cat}</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{cb.map(b=>{const on=unlockedIds.has(b.id);return<div key={b.id} style={{background:on?(dark?"linear-gradient(135deg,rgba(253,230,138,0.22),rgba(252,200,100,0.18))":"linear-gradient(135deg,rgba(253,230,138,0.45),rgba(252,200,100,0.3))"):(dark?"rgba(255,255,255,0.06)":"rgba(200,180,170,0.1)"),borderRadius:14,padding:"10px 6px",textAlign:"center",border:on?"1.5px solid rgba(252,200,100,0.5)":`1.5px solid ${dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.2)"}`}}><div style={{fontSize:26,marginBottom:3,opacity:on?1:0.25}}>{on?b.emoji:"🔒"}</div><div style={{fontSize:9,fontWeight:700,color:on?(dark?"#e8c860":"#7a5a20"):(dark?"#5a8a80":"#c4a882"),lineHeight:1.3}}>{b.label}</div></div>;})}</div></div>;})}
    </Card>
  );
  const cardMap = {heatmap:heatmapCard, streak:streakCard, badges:badgesCard};
  const layout = (settings.layouts||DEF_LAYOUTS).progres || DEF_LAYOUTS.progres;

  return (
    <div>

      {layout.map(id=>cardMap[id]||null)}
    </div>
  );
};

// ══ ANALYSE ═══════════════════════════════════════════════════════════════════
const AnalyseTab = ({data,settings,setSettings,expenses}) => {
  const dark = settings.darkMode||false;
  const {keys,PeriodBar} = usePeriodFilter(data);
  const days = keys.map(k=>data[k]).filter(Boolean);

  const factorCount={};
  days.forEach(d=>Object.values(d.cigFactors||{}).forEach(f=>{if(f)factorCount[f]=(factorCount[f]||0)+1;}));
  const maxFactor=Math.max(...Object.values(factorCount),1);
  const factorStats=FACTORS.filter(f=>factorCount[f.id]).map(f=>({...f,count:factorCount[f.id]||0})).sort((a,b)=>b.count-a.count);

  const allCravings=[];
  days.forEach(d=>Object.values(d.cigCravings||{}).forEach(v=>{if(v)allCravings.push(v);}));
  const avgCraving=allCravings.length?(allCravings.reduce((a,b)=>a+b,0)/allCravings.length).toFixed(1):null;
  const cravingDist=[1,2,3,4,5].map(sc=>({sc,count:allCravings.filter(c=>c===sc).length}));
  const maxCraving=Math.max(...cravingDist.map(c=>c.count),1);
  const cravingColors={1:"#86efac",2:"#fcd34d",3:"#fb923c",4:"#f87171",5:"#e11d48"};

  const typeStats={};
  days.forEach(d=>{const types=d.cigTypes||{};d.cigs.forEach((_,i)=>{const t=types[i]||"cigarette";typeStats[t]=(typeStats[t]||0)+1;});});
  const totalCig=days.reduce((s,d)=>s+d.cigs.length,0);

  const cyclePhaseStats={};
  if(settings.cycleTracking&&settings.cycleStartDate){
    keys.forEach(k=>{const ph=getCyclePhase(settings,k);if(!ph)return;const cnt=data[k]?.cigs?.length||0;if(!cyclePhaseStats[ph.label])cyclePhaseStats[ph.label]={total:0,days:0,emoji:ph.emoji,color:ph.color};cyclePhaseStats[ph.label].total+=cnt;cyclePhaseStats[ph.label].days+=1;});
  }

  const allKeys2=Object.keys(data).sort();
  const exportCSV=()=>{const rows=[["Date","Conso.","Objectif","Types","Facteurs","Envie moy","Note"]];allKeys2.forEach(k=>{const d=data[k];if(d){const factors=Object.values(d.cigFactors||{}).map(f=>factorById[f]?.label).filter(Boolean).join("|");const types=Object.values(d.cigTypes||{}).join("|");const cravings=Object.values(d.cigCravings||{});const avgCr=cravings.length?(cravings.reduce((a,b)=>a+b,0)/cravings.length).toFixed(1):"";rows.push([k,d.cigs.length,d.goal,types,factors,avgCr,d.note||""]);} });const csv="\uFEFF"+rows.map(r=>r.join(";")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="smoketrack_export.csv";a.click();};

  const tC=dark?"#f0f4f2":"#5a3a30", stC=dark?"#90b8a8":"#a07868";
  const layout = (settings.layouts||DEF_LAYOUTS).analyse || DEF_LAYOUTS.analyse;
  const factorsCard = settings.showFactors&&factorStats.length>0 ? (
    <Card key="factors" dark={dark}><Lbl dark={dark}>🔍 Facteurs déclenchants</Lbl>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {factorStats.map(f=><div key={f.id} style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:18,width:24}}>{f.emoji}</span><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,fontWeight:600,color:tC}}>{f.label}</span><span style={{fontSize:12,fontWeight:800,color:stC}}>{f.count}×</span></div><div style={{background:dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.2)",borderRadius:99,height:8,overflow:"hidden"}}><div style={{height:"100%",width:`${(f.count/maxFactor)*100}%`,background:dark?"#f08080":"#fca5a5",borderRadius:99}}/></div></div></div>)}
      </div>
    </Card>
  ) : null;
  const cravingsCard = settings.showCravings&&allCravings.length>0 ? (
    <Card key="cravings" dark={dark}><Lbl dark={dark}>🌡️ Notes d'envie — moy. {avgCraving}/5</Lbl>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {cravingDist.map(({sc,count})=>{const labels=["","Légère","Modérée","Forte","Très forte","Irrésistible"];return<div key={sc} style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:18,height:18,borderRadius:6,background:cravingColors[sc],display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:10,fontWeight:900,color:"white"}}>{sc}</span></div><div style={{fontSize:12,color:dark?"#a0b8b0":"#7a5a50",fontWeight:600,width:76}}>{labels[sc]}</div><div style={{flex:1,background:dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.2)",borderRadius:99,height:10,overflow:"hidden"}}><div style={{height:"100%",width:`${(count/maxCraving)*100}%`,background:cravingColors[sc],borderRadius:99}}/></div><div style={{fontSize:12,fontWeight:800,color:tC,width:24,textAlign:"right"}}>{count||"–"}</div></div>;})}
      </div>
    </Card>
  ) : null;
  const cardMap = {factors:factorsCard, cravings:cravingsCard};

  return (
    <div>
      <PeriodBar showToday={false}/>


      {Object.keys(typeStats).length>0&&<Card dark={dark}><Lbl dark={dark}>🛒 Répartition par produit</Lbl>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {Object.entries(typeStats).sort((a,b)=>b[1]-a[1]).map(([tid,cnt])=>{const t=SMOKE_TYPES.find(x=>x.id===tid);const pct=totalCig>0?Math.round((cnt/totalCig)*100):0;return<div key={tid} style={{flex:1,minWidth:80,background:dark?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.62)",borderRadius:14,padding:"12px 10px",textAlign:"center"}}><div style={{fontSize:28}}>{t?.emoji||"🚬"}</div><div style={{fontSize:20,fontWeight:900,color:tC}}>{cnt}</div><div style={{fontSize:11,color:stC}}>{t?.label||tid}</div><div style={{fontSize:10,color:dark?"#6a9a8a":"#b0a090"}}>{pct}%</div></div>;})}
        </div>
      </Card>}

      {settings.cycleTracking&&Object.keys(cyclePhaseStats).length>0&&<Card dark={dark}><Lbl dark={dark}>🌙 Conso. par phase du cycle</Lbl>
        {Object.entries(cyclePhaseStats).map(([label,{total,days:d,emoji,color}])=>(
          <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(200,180,170,0.15)"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{emoji}</span><div><div style={{fontSize:13,fontWeight:700,color:tC}}>{label}</div><div style={{fontSize:11,color:stC}}>{d} jour{d>1?"s":""}</div></div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:900,color:color}}>{d>0?(total/d).toFixed(1):0}</div><div style={{fontSize:10,color:stC}}>moy/jour</div></div>
          </div>
        ))}
      </Card>}

      {layout.map(id=>cardMap[id]||null)}

      <button onClick={exportCSV} style={{width:"100%",background:dark?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.6)",border:`1.5px solid ${dark?"rgba(255,255,255,0.2)":"rgba(200,180,170,0.3)"}`,borderRadius:14,padding:12,fontSize:14,fontWeight:700,color:tC,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14}}>
        <Icon name="download" size={16} color={tC}/> Exporter CSV
      </button>
    </div>
  );
};

// ══ EXPENSES PANEL ════════════════════════════════════════════════════════════
const ExpensesPanel = ({expenses,setExpenses,settings,dark}) => {
  const [cat,setCat]   = useState("cigarette");
  const [amt,setAmt]   = useState("");
  const [date,setDate] = useState(today());
  const [note,setNote] = useState("");
  const tC=dark?"#f0f4f2":"#5a3a30", stC=dark?"#90b8a8":"#a07868";
  const addExp=()=>{ if(!amt||parseFloat(amt)<=0)return; const n=[...expenses,{id:Date.now(),cat,amount:parseFloat(amt),date,note}]; setExpenses(n); saveExpenses(n); setAmt(""); setNote(""); };
  const delExp=id=>{ const n=expenses.filter(e=>e.id!==id); setExpenses(n); saveExpenses(n); };
  const sorted=[...expenses].sort((a,b)=>b.date.localeCompare(a.date));
  const totalAll=expenses.reduce((s,e)=>s+e.amount,0);
  const thisMo=today().slice(0,7);
  const totalMo=expenses.filter(e=>e.date.startsWith(thisMo)).reduce((s,e)=>s+e.amount,0);
  const iS={border:`1.5px solid ${dark?"rgba(255,255,255,0.18)":"rgba(200,180,170,0.4)"}`,background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.85)",borderRadius:10,padding:"8px 10px",fontSize:14,color:tC,outline:"none"};

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:dark?"rgba(252,165,165,0.13)":"rgba(252,165,165,0.2)",borderRadius:14,padding:14,textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:dark?"#f0a0a0":"#c05040"}}>{totalMo.toFixed(2)}{settings.currency}</div><div style={{fontSize:11,color:stC}}>Ce mois-ci</div></div>
        <div style={{background:dark?"rgba(253,230,138,0.1)":"rgba(253,230,138,0.25)",borderRadius:14,padding:14,textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:dark?"#e0c060":"#7a6030"}}>{totalAll.toFixed(2)}{settings.currency}</div><div style={{fontSize:11,color:stC}}>Total</div></div>
      </div>

      <div style={{background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.65)",borderRadius:16,padding:16,marginBottom:14,border:dark?"1px solid rgba(255,255,255,0.12)":"1px solid rgba(255,255,255,0.8)"}}>
        <div style={{fontSize:12,fontWeight:700,color:dark?"#5ecfa0":"#a0857a",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>➕ Nouvelle dépense</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
          {EXPENSE_CATS.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{padding:"10px 8px",borderRadius:12,border:cat===c.id?"2px solid #fb7185":"2px solid rgba(200,180,170,0.25)",background:cat===c.id?(dark?"rgba(252,165,165,0.15)":"rgba(252,165,165,0.2)"):(dark?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.7)"),cursor:"pointer",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{c.emoji}</span><span style={{fontSize:11,fontWeight:600,color:cat===c.id?"#c05040":(dark?"#c0c8c4":"#a07868"),textAlign:"left",lineHeight:1.3}}>{c.label}</span></button>)}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <div style={{flex:1}}><div style={{fontSize:11,color:stC,marginBottom:4}}>Montant</div><div style={{display:"flex",alignItems:"center",gap:4}}><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00" min="0" step="0.01" style={{...iS,width:"100%",fontWeight:700}}/><span style={{fontSize:15,fontWeight:700,color:stC,flexShrink:0}}>{settings.currency}</span></div></div>
          <div style={{flex:1}}><div style={{fontSize:11,color:stC,marginBottom:4}}>Date</div><input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)} style={{...iS,width:"100%"}}/></div>
        </div>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note (optionnel)…" style={{...iS,width:"100%",marginBottom:12,boxSizing:"border-box"}}/>
        <button onClick={addExp} disabled={!amt||parseFloat(amt)<=0} style={{width:"100%",background:amt&&parseFloat(amt)>0?"linear-gradient(135deg,#fca5a5,#fb7185)":"rgba(200,180,170,0.3)",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:700,color:amt&&parseFloat(amt)>0?"white":(dark?"#708070":"#c0b0a0"),cursor:amt&&parseFloat(amt)>0?"pointer":"default",transition:"all 0.2s"}}>💸 Enregistrer</button>
      </div>

      {sorted.length>0&&<div style={{background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.65)",borderRadius:16,padding:16,border:dark?"1px solid rgba(255,255,255,0.12)":"1px solid rgba(255,255,255,0.8)"}}>
        <div style={{fontSize:12,fontWeight:700,color:dark?"#5ecfa0":"#a0857a",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>📋 Historique</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {sorted.map(e=>{const c=EXPENSE_CATS.find(x=>x.id===e.cat);return<div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${dark?"rgba(255,255,255,0.07)":"rgba(200,180,170,0.15)"}`}}>
            <span style={{fontSize:22}}>{c?.emoji||"💸"}</span>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:tC}}>{c?.label||e.cat}</div><div style={{fontSize:11,color:stC}}>{new Date(e.date+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}{e.note?` · ${e.note}`:""}</div></div>
            <div style={{fontWeight:800,fontSize:15,color:dark?"#f0a0a0":"#c05040"}}>{e.amount.toFixed(2)}{settings.currency}</div>
            <button onClick={()=>delExp(e.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,opacity:0.7}}><Icon name="trash" size={14} color="#f87171"/></button>
          </div>;})}
        </div>
      </div>}
    </div>
  );
};

// ══ WALLET ════════════════════════════════════════════════════════════════════
const WalletTab = ({data, settings, setSettings, expenses, setExpenses}) => {
  const dark = settings.darkMode||false;
  const tC=dark?"#f0f4f2":"#5a3a30", stC=dark?"#90b8a8":"#a07868";
  const cpCig=(settings.pricePerPack||12)/(settings.cigsPerPack||20);
  const allKeys=Object.keys(data).sort();
  const {keys,PeriodBar}=usePeriodFilter(data);
  const days=keys.map(k=>data[k]).filter(Boolean);
  const total=days.reduce((s,d)=>s+d.cigs.length,0);
  const daysCount=Math.max(days.length,1);

  // Coût estimé période
  const estCost=(total*cpCig).toFixed(2);

  // Dépenses réelles période
  const ps=keys[0]||"", pe=keys[keys.length-1]||"";
  const realExp=expenses.filter(e=>e.date>=ps&&e.date<=pe);
  const realExpTotal=realExp.reduce((s,e)=>s+e.amount,0);

  // Argent économisé vs habitude
  const habitCost=(settings.usualCigs||20)*cpCig;
  const savedPerDay=Math.max(0,habitCost-(total/daysCount*cpCig));
  const savedTotal=(savedPerDay*daysCount).toFixed(2);
  const savedMonth=(savedPerDay*30).toFixed(2);
  const savedYear=(savedPerDay*365).toFixed(2);

  // Totaux dépenses
  const thisMo=new Date().toISOString().slice(0,7);
  const totalMo=expenses.filter(e=>e.date.startsWith(thisMo)).reduce((s,e)=>s+e.amount,0);
  const totalAll=expenses.reduce((s,e)=>s+e.amount,0);

  // Ajout dépense
  const [cat,setCat]=useState("cigarette");
  const [amt,setAmt]=useState("");
  const [date,setDate]=useState(today());
  const [note,setNote]=useState("");
  const addExp=()=>{if(!amt||parseFloat(amt)<=0)return;const n=[...expenses,{id:Date.now(),cat,amount:parseFloat(amt),date,note}];setExpenses(n);saveExpenses(n);setAmt("");setNote("");};
  const delExp=id=>{const n=expenses.filter(e=>e.id!==id);setExpenses(n);saveExpenses(n);};
  const iS={border:`1.5px solid ${dark?"rgba(255,255,255,0.18)":"rgba(200,180,170,0.4)"}`,background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.85)",borderRadius:10,padding:"8px 10px",fontSize:14,color:tC,outline:"none"};

  return (
    <div>
      <PeriodBar showToday={false}/>

      {/* Résumé coûts */}
      <Card dark={dark}>
        <Lbl dark={dark}>💸 Coût de la période</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div style={{background:dark?"rgba(252,165,165,0.12)":"rgba(252,165,165,0.2)",borderRadius:12,padding:12,textAlign:"center"}}>
            <div style={{fontSize:11,color:stC,marginBottom:4}}>Estimé</div>
            <div style={{fontSize:24,fontWeight:900,color:dark?"#f0a0a0":"#c05040"}}>{estCost}{settings.currency||"€"}</div>
            <div style={{fontSize:10,color:stC}}>{total} cig × {cpCig.toFixed(2)}{settings.currency||"€"}</div>
          </div>
          <div style={{background:dark?"rgba(253,230,138,0.1)":"rgba(253,230,138,0.25)",borderRadius:12,padding:12,textAlign:"center"}}>
            <div style={{fontSize:11,color:stC,marginBottom:4}}>Réel (dépenses)</div>
            <div style={{fontSize:24,fontWeight:900,color:dark?"#e0c060":"#7a6030"}}>{realExpTotal>0?`${realExpTotal.toFixed(2)}${settings.currency||"€"}`:"–"}</div>
            {realExp.length>0&&<div style={{fontSize:10,color:stC}}>{realExp.length} achat{realExp.length>1?"s":""}</div>}
          </div>
        </div>
        {realExp.length>0&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:4}}>
          {EXPENSE_CATS.map(cat=>{const tot=realExp.filter(e=>e.cat===cat.id).reduce((s,e)=>s+e.amount,0);return tot>0&&<div key={cat.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:dark?"#c0c8c4":"#7a6a60",padding:"4px 0",borderBottom:`1px solid ${dark?"rgba(255,255,255,0.07)":"rgba(200,180,170,0.15)"}`}}><span>{cat.emoji} {cat.label}</span><span style={{fontWeight:700}}>{tot.toFixed(2)}{settings.currency||"€"}</span></div>;})}
        </div>}
      </Card>

      {/* Argent économisé */}
      {parseFloat(savedTotal)>0&&<Card dark={dark}>
        <Lbl dark={dark}>💰 Argent économisé vs ton habitude</Lbl>
        <div style={{textAlign:"center",padding:"10px 0 14px"}}>
          <div style={{fontSize:11,color:stC,marginBottom:4}}>Sur cette période</div>
          <div style={{fontSize:44,fontWeight:900,color:dark?"#4ade80":"#2a7a40",lineHeight:1}}>{savedTotal}{settings.currency||"€"}</div>
          <div style={{fontSize:11,color:stC,marginTop:4}}>vs {settings.usualCigs||20} cig/j habituels</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["/ mois",savedMonth,"rgba(134,239,172,0.2)","#2a6a40"],["/ an",savedYear,"rgba(74,222,128,0.15)","#1a5a30"]].map(([l,v,bg,c])=>(
            <div key={l} style={{background:dark?"rgba(74,222,128,0.1)":bg,borderRadius:12,padding:10,textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:900,color:dark?"#4ade80":c}}>{v}{settings.currency||"€"}</div>
              <div style={{fontSize:10,color:stC}}>{l} à ce rythme</div>
            </div>
          ))}
        </div>
      </Card>}

      {/* Résumé dépenses */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:dark?"rgba(252,165,165,0.13)":"rgba(252,165,165,0.2)",borderRadius:14,padding:14,textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:dark?"#f0a0a0":"#c05040"}}>{totalMo.toFixed(2)}{settings.currency||"€"}</div>
          <div style={{fontSize:11,color:stC}}>Ce mois-ci</div>
        </div>
        <div style={{background:dark?"rgba(253,230,138,0.1)":"rgba(253,230,138,0.25)",borderRadius:14,padding:14,textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:dark?"#e0c060":"#7a6030"}}>{totalAll.toFixed(2)}{settings.currency||"€"}</div>
          <div style={{fontSize:11,color:stC}}>Total</div>
        </div>
      </div>

      {/* Ajouter dépense */}
      <Card dark={dark}>
        <Lbl dark={dark}>➕ NOUVELLE DÉPENSE</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
          {EXPENSE_CATS.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{padding:"10px 8px",borderRadius:12,border:cat===c.id?"2px solid #fb7185":"2px solid rgba(200,180,170,0.25)",background:cat===c.id?(dark?"rgba(252,165,165,0.15)":"rgba(252,165,165,0.2)"):(dark?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.7)"),cursor:"pointer",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{c.emoji}</span><span style={{fontSize:11,fontWeight:600,color:cat===c.id?"#c05040":(dark?"#c0c8c4":"#a07868")}}>{c.label}</span></button>)}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:stC,marginBottom:4}}>Montant</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00" min="0" step="0.01" style={{...iS,width:"100%",fontWeight:700}}/><span style={{fontSize:15,fontWeight:700,color:stC,flexShrink:0}}>{settings.currency||"€"}</span></div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:stC,marginBottom:4}}>Date</div>
            <input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)} style={{...iS,width:"100%"}}/>
          </div>
        </div>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note (optionnel)…" style={{...iS,width:"100%",marginBottom:12,boxSizing:"border-box"}}/>
        <button onClick={addExp} disabled={!amt||parseFloat(amt)<=0} style={{width:"100%",background:amt&&parseFloat(amt)>0?"linear-gradient(135deg,#fca5a5,#fb7185)":"rgba(200,180,170,0.3)",border:"none",borderRadius:12,padding:12,fontSize:14,fontWeight:700,color:amt&&parseFloat(amt)>0?"white":"#c0b0a0",cursor:amt&&parseFloat(amt)>0?"pointer":"default"}}>💸 Enregistrer</button>
      </Card>

      {/* Historique */}
      {expenses.length>0&&<Card dark={dark}>
        <Lbl dark={dark}>📋 HISTORIQUE</Lbl>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {[...expenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>{const c=EXPENSE_CATS.find(x=>x.id===e.cat);return<div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${dark?"rgba(255,255,255,0.07)":"rgba(200,180,170,0.15)"}`}}>
            <span style={{fontSize:22}}>{c?.emoji||"💸"}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:tC}}>{c?.label||e.cat}</div>
              <div style={{fontSize:11,color:stC}}>{new Date(e.date+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}{e.note?` · ${e.note}`:""}</div>
            </div>
            <div style={{fontWeight:800,fontSize:15,color:dark?"#f0a0a0":"#c05040"}}>{e.amount.toFixed(2)}{settings.currency||"€"}</div>
            <button onClick={()=>delExp(e.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,opacity:0.7}}><Icon name="trash" size={14} color="#f87171"/></button>
          </div>;})}
        </div>
      </Card>}

      {/* Export CSV */}
      <button onClick={()=>{const rows=[["Date","Catégorie","Montant","Note"]];[...expenses].sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>{const c=EXPENSE_CATS.find(x=>x.id===e.cat);rows.push([e.date,c?.label||e.cat,e.amount.toFixed(2),e.note||""]);});const csv="\uFEFF"+rows.map(r=>r.join(";")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="depenses_smoketrack.csv";a.click();}} style={{width:"100%",background:dark?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.6)",border:`1.5px solid ${dark?"rgba(255,255,255,0.2)":"rgba(200,180,170,0.3)"}`,borderRadius:14,padding:12,fontSize:14,fontWeight:700,color:tC,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14}}>
        <Icon name="download" size={16} color={tC}/> Exporter CSV
      </button>
    </div>
  );
};


const SettingsTab = ({data,setData,settings,setSettings,expenses,setExpenses}) => {
  const dark = settings.darkMode||false;
  const [confirmReset,setConfirmReset] = useState(false);
  const upd = p=>{ const n={...settings,...p}; setSettings(n); saveSettings(n); };
  const tC=dark?"#f0f4f2":"#5a3a30", stC=dark?"#90b8a8":"#a07868";
  const iS={border:`1.5px solid ${dark?"rgba(255,255,255,0.18)":"rgba(200,180,170,0.3)"}`,background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.75)",borderRadius:10,padding:"6px 10px",fontSize:14,color:tC,outline:"none"};
  const Row=({icon,label,children})=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(200,180,170,0.15)"}`}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,background:dark?"rgba(255,255,255,0.1)":"rgba(200,180,170,0.2)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name={icon} size={16} color={dark?"#90b8a8":"#a0857a"}/></div><span style={{fontSize:14,color:tC,fontWeight:600}}>{label}</span></div>{children}</div>;

  return (
    <div>
      {/* PROFIL */}
      <Card dark={dark}><Lbl dark={dark}>👤 PROFIL</Lbl>
        <Row icon="user" label="Prénom"><StableInput value={settings.name} onCommit={v=>upd({name:v})} placeholder="Ton prénom" style={{...iS,width:130}}/></Row>
        <Row icon="target" label="Objectif par défaut"><StableInput type="number" value={settings.defaultGoal} onCommit={v=>upd({defaultGoal:Math.max(1,parseInt(v)||1)})} style={{...iS,width:70,textAlign:"right"}}/></Row>
      </Card>

      {/* APPARENCE */}
      <Card dark={dark}><Lbl dark={dark}>🎨 APPARENCE</Lbl>
        <Toggle val={!!settings.darkMode} onChange={v=>upd({darkMode:v})} label="🌙 Mode sombre" desc="Interface sombre pour la nuit" dark={dark}/>
        <Toggle val={settings.autoDark!==false} onChange={v=>upd({autoDark:v})} label="🌛 Mode sombre automatique" desc="S'active entre coucher et lever du soleil" dark={dark}/>
      </Card>

      {/* FONCTIONNALITÉS */}
      <Card dark={dark}><Lbl dark={dark}>⚙️ FONCTIONNALITÉS AFFICHÉES</Lbl>
        <Toggle val={settings.showFactors!==false} onChange={v=>upd({showFactors:v})} label="🔍 Facteurs déclenchants" desc="Dans la saisie et les analyses" dark={dark}/>
        <Toggle val={settings.showCravings!==false} onChange={v=>upd({showCravings:v})} label="🌡️ Note d'envie" desc="Niveau d'envie lors de la saisie" dark={dark}/>
        <Toggle val={settings.showEvents!==false} onChange={v=>upd({showEvents:v})} label="📅 Événements du jour" desc="Lever, repas, dîner, coucher" dark={dark}/>
      </Card>

      {/* PRODUITS */}
      <Card dark={dark}><Lbl dark={dark}>🛒 CE QUE TU FUMES</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:8}}>
          {SMOKE_TYPES.map(t=>{const active=(settings.smokeTypes||["cigarette"]).includes(t.id);return<button key={t.id} onClick={()=>{const cur=settings.smokeTypes||["cigarette"];const next=active?(cur.length>1?cur.filter(x=>x!==t.id):cur):[...cur,t.id];upd({smokeTypes:next});}} style={{padding:"14px 8px",borderRadius:16,border:active?"2.5px solid #fb7185":"2px solid rgba(200,180,170,0.25)",background:active?(dark?"rgba(252,165,165,0.15)":"rgba(252,165,165,0.2)"):(dark?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.7)"),cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><span style={{fontSize:32}}>{t.emoji}</span><span style={{fontSize:12,fontWeight:700,color:active?"#c05040":(dark?"#c0d0c8":"#a07868")}}>{t.label}</span>{active&&<span style={{fontSize:9,background:"rgba(251,113,133,0.2)",borderRadius:99,padding:"2px 8px",color:"#c05040",fontWeight:700}}>✓ Actif</span>}</button>;})}
        </div>
        <div style={{fontSize:11,color:stC,textAlign:"center"}}>Tu dois avoir au moins un produit actif</div>
      </Card>

      {/* COÛT */}
      <Card dark={dark}><Lbl dark={dark}>💰 COÛT & HABITUDE</Lbl>
        <Row icon="coin" label="Prix / paquet"><div style={{display:"flex",gap:6}}><StableInput type="number" value={settings.pricePerPack} onCommit={v=>upd({pricePerPack:parseFloat(v)||10})} style={{...iS,width:70,textAlign:"right"}}/><StableInput value={settings.currency} onCommit={v=>upd({currency:v||"€"})} style={{...iS,width:38,textAlign:"center"}}/></div></Row>
        <Row icon="target" label="Cigs / paquet"><StableInput type="number" value={settings.cigsPerPack} onCommit={v=>upd({cigsPerPack:parseInt(v)||20})} style={{...iS,width:70,textAlign:"right"}}/></Row>
        <Row icon="savings" label="Habitude (cig/j)"><StableInput type="number" value={settings.usualCigs} onCommit={v=>upd({usualCigs:parseInt(v)||20})} style={{...iS,width:70,textAlign:"right"}}/></Row>
      </Card>

      {/* CYCLE */}
      <Card dark={dark}><Lbl dark={dark}>🌙 CYCLE UTÉRIN</Lbl>
        <div style={{fontSize:13,color:stC,marginBottom:14,lineHeight:1.6}}>Active pour analyser ta conso. en fonction des phases de ton cycle menstruel.</div>
        <Toggle val={!!settings.cycleTracking} onChange={v=>upd({cycleTracking:v})} label="🌙 Activer le suivi" desc="Affiche la phase dans l'accueil et l'analyse" dark={dark}/>
        {settings.cycleTracking&&<div style={{marginTop:14}}>
          <div style={{padding:"10px 0",borderBottom:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(200,180,170,0.15)"}`}}>
            <div style={{fontSize:13,fontWeight:600,color:tC,marginBottom:8}}>📅 Début des dernières règles</div>
            <input type="date" value={settings.cycleStartDate||""} max={today()} onChange={e=>upd({cycleStartDate:e.target.value})} style={{...iS,width:"100%",boxSizing:"border-box"}}/>
          </div>
          <div style={{padding:"10px 0"}}>
            <div style={{fontSize:13,fontWeight:600,color:tC,marginBottom:8}}>🔄 Durée du cycle (jours)</div>
            <StableInput type="number" value={settings.cycleDays||28} min="21" max="35" onCommit={v=>upd({cycleDays:Math.max(21,Math.min(35,parseInt(v)||28))})} style={{...iS,width:80,textAlign:"center"}}/>
          </div>
          {settings.cycleStartDate&&(()=>{const ph=getCyclePhase(settings,today());return ph&&<div style={{marginTop:8,padding:"12px 14px",borderRadius:14,background:ph.bg,border:`1.5px solid ${ph.color}50`}}><div style={{fontSize:13,fontWeight:700,color:ph.color}}>Phase actuelle : {ph.emoji} {ph.label}</div></div>;})()}
          <div style={{marginTop:12,display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {[{label:"Menstruations",emoji:"🔴",days:"J1–J5",color:"#f87171"},{label:"Folliculaire",emoji:"🌱",days:"J6–J13",color:"#4ade80"},{label:"Ovulation",emoji:"🌕",days:"J14–J16",color:"#fbbf24"},{label:"Lutéale",emoji:"🌙",days:"J17–J28",color:"#a78bfa"}].map(p=><div key={p.label} style={{background:dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.65)",borderRadius:12,padding:"8px 10px",display:"flex",alignItems:"center",gap:8,border:`1px solid ${p.color}40`}}><span style={{fontSize:18}}>{p.emoji}</span><div><div style={{fontSize:11,fontWeight:700,color:p.color}}>{p.label}</div><div style={{fontSize:10,color:stC}}>{p.days}</div></div></div>)}
          </div>
        </div>}
      </Card>

      {/* DONNÉES */}
      <Card dark={dark}><Lbl dark={dark}>📊 MES DONNÉES</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div style={{background:dark?"rgba(252,165,165,0.1)":"rgba(252,165,165,0.2)",borderRadius:12,padding:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:900,color:dark?"#f0c0b8":"#5a3a30"}}>{Object.values(data).reduce((s,d)=>s+(d.cigs?.length||0),0)}</div><div style={{fontSize:11,color:stC}}>consommations</div></div>
          <div style={{background:dark?"rgba(196,181,253,0.1)":"rgba(196,181,253,0.2)",borderRadius:12,padding:12,textAlign:"center"}}><div style={{fontSize:28,fontWeight:900,color:dark?"#c4b5fd":"#5a3a90"}}>{Object.keys(data).length}</div><div style={{fontSize:11,color:stC}}>jours</div></div>
        </div>
      </Card>

      {/* ZONE DANGER */}
      <Card dark={dark} style={{border:`1.5px solid ${dark?"rgba(248,113,113,0.35)":"rgba(248,113,113,0.3)"}`}}><Lbl dark={dark}>⚠️ Zone danger</Lbl>
        {!confirmReset?<button onClick={()=>setConfirmReset(true)} style={{width:"100%",background:dark?"rgba(248,113,113,0.1)":"rgba(248,113,113,0.15)",border:"1.5px solid rgba(248,113,113,0.3)",borderRadius:12,padding:10,fontSize:14,fontWeight:700,color:"#f87171",cursor:"pointer"}}>🗑️ Effacer toutes les données</button>
        :<div><div style={{fontSize:13,color:"#f87171",marginBottom:10,textAlign:"center",fontWeight:600}}>⚠️ Action irréversible ?</div><div style={{display:"flex",gap:10}}><button onClick={()=>setConfirmReset(false)} style={{flex:1,background:dark?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.6)",border:"none",borderRadius:12,padding:10,fontSize:14,cursor:"pointer",color:tC}}>Annuler</button><button onClick={()=>{setData({});saveData({});setExpenses([]);saveExpenses([]);setConfirmReset(false);}} style={{flex:1,background:"rgba(248,113,113,0.25)",border:"none",borderRadius:12,padding:10,fontSize:14,fontWeight:700,cursor:"pointer",color:"#f87171"}}>Confirmer</button></div></div>}
      </Card>
    </div>
  );
};

// ══ APP ROOT ══════════════════════════════════════════════════════════════════
export default function App() {
  const [data,setData]         = useState(loadData);
  const [settings,setSettings] = useState(loadSettings);
  const [expenses,setExpenses] = useState(loadExpenses);
  const [tab,setTab]           = useState("home");
  const [tick,setTick]         = useState(0);

  // Auto dark mode: refresh every minute to check night time
  useEffect(()=>{
    const id = setInterval(()=>setTick(t=>t+1), 60000);
    return ()=>clearInterval(id);
  },[]);

  const day = data[today()]||defDay();
  // dark = manual ON always dark / auto mode = dark only at night / manual OFF = never dark
  const dark = settings.darkMode ? true : (settings.autoDark !== false ? isNightTime(data) : false);
  const bg   = getBg(day.cigs.length,day.goal,dark);
  const tabs = [
    {id:"home",icon:"home",label:"Accueil"},
    {id:"calendar",icon:"calendar",label:"Calendrier"},
    {id:"stats",icon:"chart",label:"Stats"},
    {id:"progres",icon:"trophy",label:"Progrès"},
    {id:"analyse",icon:"brain",label:"Analyse"},
    {id:"wallet",icon:"wallet",label:"Portefeuille"},
    {id:"settings",icon:"settings",label:"Réglages"},
  ];
  const activeClr=dark?"#4ade80":"#d05a40", inactClr=dark?"#3a6055":"#b09080";
  return (
    <div style={{minHeight:"100dvh",background:bg,transition:"background 1.2s",fontFamily:"system-ui,sans-serif"}}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}input,button,textarea{font-family:inherit;}::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-thumb{background:rgba(150,130,120,0.3);border-radius:99px;}`}</style>
      <div style={{padding:"20px 20px 8px",textAlign:"center"}}>
        <div style={{fontSize:22}}>🚬</div>
        <div style={{fontSize:18,fontWeight:900,color:dark?"#d8ece4":"#5a3a30",letterSpacing:"-0.02em"}}>SmokeTrack</div>
        <div style={{fontSize:11,color:dark?"#4a7a6a":"#a07868"}}>Ton compagnon pour arrêter</div>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 14px 96px"}}>
        {tab==="home"     &&<HomeTab     data={data} setData={setData} settings={settings} setSettings={setSettings} expenses={expenses}/>}
        {tab==="calendar" &&<CalendarTab data={data} setData={setData} settings={settings} setSettings={setSettings} expenses={expenses}/>}
        {tab==="stats"    &&<StatsTab    data={data} settings={settings} setSettings={setSettings} expenses={expenses}/>}
        {tab==="progres"  &&<ProgressTab data={data} settings={settings} setSettings={setSettings}/>}
        {tab==="analyse"  &&<AnalyseTab  data={data} settings={settings} setSettings={setSettings} expenses={expenses}/>}
        {tab==="wallet"   &&<WalletTab   data={data} settings={settings} setSettings={setSettings} expenses={expenses} setExpenses={setExpenses}/>}
        {tab==="settings" &&<SettingsTab data={data} setData={setData} settings={settings} setSettings={setSettings} expenses={expenses} setExpenses={setExpenses}/>}
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:dark?"rgba(8,13,18,0.97)":"rgba(255,255,255,0.9)",backdropFilter:"blur(20px)",borderTop:dark?"1px solid rgba(255,255,255,0.1)":"1px solid rgba(200,180,170,0.3)",display:"flex",justifyContent:"space-around",padding:"6px 0 max(8px,env(safe-area-inset-bottom))"}}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"3px 4px",color:tab===t.id?activeClr:inactClr,transition:"color 0.2s",minWidth:44}}><Icon name={t.icon} size={22} color={tab===t.id?activeClr:inactClr}/><span style={{fontSize:9,fontWeight:tab===t.id?700:500}}>{t.label}</span></button>)}
      </div>
    </div>
  );
}
