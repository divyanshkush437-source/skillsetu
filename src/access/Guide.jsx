import areaNames from "./areas.json";
import React,{useEffect,useRef,useState} from "react";
import {Globe2,Home,Volume2,Square,ChevronLeft,Search,BriefcaseBusiness,MapPin,UserRound,ClipboardList,ArrowRight,MessageCircle,Hand,Check} from "lucide-react";
import {packs} from "./catalog.mjs";
import {config,api,live,read,save,navigate,demoWorkers,wa,route} from "../data";
import {tradeIcons} from "../ui";
const Auth=React.lazy(()=>import("../account").then(m=>({default:m.Auth})));
import {firebaseAuth} from "../auth";
import {areasOf,available,visible} from "../../backend/listing.mjs";

function Language({code,change}){
  return <label className="languagePicker"><Globe2 aria-hidden="true"/><select aria-label="Language / भाषा" value={code} onChange={e=>change(e.target.value)}>{Object.values(packs).map(p=><option key={p.code} value={p.code} lang={p.code} dir="auto">{p.name}</option>)}</select></label>;
}
function AudioGuide({pack,words,speaker}){
  const [state,setState]=useState("idle");
  const current=useRef(null);
  const request=useRef(0);
  function stop(){
    request.current++;
    window.speechSynthesis?.cancel();
    current.current?.pause();
    current.current=null;
    setState("idle");
  }
  useEffect(()=>()=>{request.current++;window.speechSynthesis?.cancel();current.current?.pause();},[pack.code,words]);
  async function speak(message=words){
    if(state==="playing" && message===words){stop();return;}
    stop();
    const attempt=request.current;
    const synth=window.speechSynthesis;
    const voice=synth?.getVoices().find(v=>v.lang.toLowerCase().split(/[-_]/)[0]===pack.code);
    if(voice && window.SpeechSynthesisUtterance){
      const line=new SpeechSynthesisUtterance(message);
      line.voice=voice;line.lang=voice.lang;line.rate=.85;
      line.onend=()=>{if(request.current===attempt)setState("idle");};
      line.onerror=()=>{
        if(request.current!==attempt)return;
        if(live)playRemote(message,attempt);
        else setState("unavailable");
      };
      setState("playing");synth.speak(line);return;
    }
    if(!live){setState("unavailable");return;}
    await playRemote(message,attempt);
  }
  async function playRemote(message,attempt){
    setState("loading");
    try{
      const result=await api("/speech",{method:"POST",body:{language:pack.code,text:message}});
      if(request.current!==attempt)return;
      const audio=new Audio("data:"+result.mimeType+";base64,"+result.audio);
      current.current=audio;
      audio.onended=()=>{if(request.current===attempt)setState("idle");};
      audio.onerror=()=>{if(request.current===attempt)setState("unavailable");};
      await audio.play();
      if(request.current===attempt)setState("playing");
    }catch{if(request.current===attempt)setState("unavailable");}
  }
  useEffect(()=>{speaker.current=speak;return()=>{speaker.current=null;};});
  return <>
    <button className="audioGuide" onClick={()=>state==="playing"||state==="loading"?stop():speak()}>
      {state==="playing"||state==="loading"?<Square/>:<Volume2/>}
      {state==="playing"?pack.t.stop:state==="loading"?pack.t.loading:pack.t.listen}
    </button>
    {state==="unavailable"&&<p role="status">{pack.t.silent}</p>}
  </>;
}
function Tile({icon:Icon=ArrowRight,children,onClick}){return <button className="guideTile" onClick={onClick}><Icon aria-hidden="true"/><span>{children}</span></button>;}
export default function Guide({path,pack,change,exit}){
  const t=pack.t, search=path==="/search", join=path==="/register", job=path==="/post-job", dash=path==="/dashboard", id=path.startsWith("/worker/")?path.slice(8):"", gated=join||job||dash;
  const query=new URLSearchParams(route().search);
  const [skill,S]=useState(query.get("skill")||""),[area,A]=useState(query.get("locality")||""),[name,N]=useState(""),[consent,C]=useState(false),[description,D]=useState("");
  const [step,T]=useState(search&&skill&&area?"results":join?"name":search||job?"trade":"home"),[workers,W]=useState([]),[own,O]=useState(null),[user,U]=useState(live?null:read("demoUser",null));
  const [busy,B]=useState(false),[err,E]=useState(""),[tick,R]=useState(0),[waiting,Q]=useState(gated||!!id||step==="results");
  const speaker=useRef(null),heading=useRef(null),requestId=useRef(null);
  const areaScript=["hi","mr","mai","doi","kok","brx","ne","sa"].includes(pack.code)?"dev":pack.code==="as"?"bn":pack.code;
  const areaLabel=a=>areaNames[areaScript]?.[config.areas.indexOf(a)]||a;
  useEffect(()=>{
    let active=true;
    const local=!live||id.startsWith("demo-")||query.get("demo")==="1";
    (async()=>{
      Q(true);E("");
      if(gated){
        const current=user||(live?(await firebaseAuth()).auth.currentUser:null);
        if(current&&!user)U(current);
        if(current&&(join||dash)){
          const w=live?await api("/me",{user:current}):demoWorkers().find(w=>w.id===current.uid);
          if(active){O(w||null);if(w&&join){N(w.name);S(w.skill);A(w.locality);}}
        }
      }else if(id){
        const w=local?demoWorkers().find(w=>w.id===id&&visible(w)):await api("/worker/"+encodeURIComponent(id));
        if(active)W(w?[w]:[]);
      }else if(search&&step==="results"){
        const list=local?demoWorkers().filter(w=>visible(w)&&w.skill===skill&&areasOf(w).includes(area)):await api("/workers?"+new URLSearchParams({skill,locality:area}));
        if(active)W(list);
      }
    })().catch(e=>active&&E(e.message)).finally(()=>active&&Q(false));
    return ()=>{active=false;};
  },[path,user,tick,step==="results"]);
  const isGate=gated&&!user;
  const phase=waiting?"loading":isGate?"phone":id?"preview":dash?"dashboard":step;
  const title=t[phase==="results"?"find":phase==="review"?"preview":phase==="done"?"saved":phase]||t.home;
  const tiles=(choices,act,icons)=>choices.map((value,index)=>{
    const label=phase==="trade"?t[value]:areaLabel(value);
    return <div className="spokenChoice" key={value}><Tile icon={icons?.[index]||MapPin} onClick={()=>act(value)}>{label}</Tile><button className="hearChoice" aria-label={t.listen+" · "+label} onClick={()=>speaker.current?.(label)}><Volume2 size={19}/></button></div>;
  });
  const areaChoices=config.areas;
  const words=[title,...(phase==="trade"?config.skills.map(v=>t[v]):phase==="area"?areaChoices.map(areaLabel):phase==="home"?[t.find,t.join,t.post,t.dashboard]:phase==="review"?[t[skill],areaLabel(area),join?t.consent:t.request]:phase==="results"||id?workers.flatMap(w=>[w.name,t[w.skill],areaLabel(w.locality),t.contact]):phase==="phone"?[live?t.send:t.demo]:[])].join(". ");
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[phase]);
  function back(){
    E("");
    if(phase==="results") {T("area");return;}
    if(phase==="review"){T(job?"request":"area");return;}
    if(phase==="request"){T("area");return;}
    if(phase==="area"){T("trade");return;}
    if(phase==="trade"&&join){T("name");return;}
    if(id){navigate("/search?"+new URLSearchParams({skill:workers[0]?.skill||"",locality:workers[0]?.locality||""}));return;}
    navigate("/");
  }
  async function run(fn){B(true);E("");try{await fn();}catch(e){E(e.message);}finally{B(false);}}
  function submit(){run(async()=>{
    if(job){
      requestId.current ||= crypto.randomUUID();
      const body={skill,locality:area,description:description.trim()||t[skill]+" — "+area,posterPhone:user.phoneNumber,requestId:requestId.current};
      if(live)await api("/job",{method:"POST",user,body});else save("jobs",[{...body,id:body.requestId,createdAt:new Date().toISOString()},...read("jobs",[]).filter(j=>j.id!==body.requestId)]);
      T("done");return;
    }
    const body={name:name.trim(),skill,locality:area,serviceAreas:(own?.serviceAreas||[]).filter(a=>a!==own?.locality&&a!==area),whatsapp:own?.whatsapp||user.phoneNumber,priceRange:own?.priceRange||"Ask for estimate",experience:own?.experience||"Not specified",availability:own?.availability??false,alerts:own?.alerts??false,listed:consent};
    if(live)await api("/worker",{method:"POST",user,body});
    else save("profiles",[...read("profiles",[]).filter(w=>w.id!==user.uid),{...own,...body,id:user.uid,lastSeen:new Date().toISOString(),whatsappLink:wa(body.whatsapp,skill)}]);
    navigate("/dashboard");
  });}
  function listing(listed){run(async()=>{
    if(live)await api("/worker/"+encodeURIComponent(own.id)+"/visibility",{method:"PATCH",user,body:{listed}});
    else save("profiles",read("profiles",[]).map(w=>w.id===own.id?{...w,listed}:w));
    O({...own,listed});C(false);
  });}
  function cards(){return workers.length?workers.map(w=><article key={w.id} className="guideCard"><h2 dir="auto">{w.name}</h2><p>{t[w.skill]} · {areaLabel(w.locality)}</p>{w.priceRange&&w.priceRange!=="Ask for estimate"&&<p>{t.price} · <bdi>{w.priceRange}</bdi></p>}{(w.id.startsWith("demo-")?w.availability:live?w.availability:available(w))===true&&<p>{t.available}</p>}{!id&&<Tile icon={UserRound} onClick={()=>navigate("/worker/"+w.id)}>{t.preview}</Tile>}<button className="guideContact" disabled={busy} onClick={()=>run(async()=>{
    if(!live||w.id.startsWith("demo-"))window.location.assign(w.whatsappLink);
    else {const r=await api("/worker/"+encodeURIComponent(w.id)+"/contact",{method:"POST"});save("receipts",{...read("receipts",{}),[r.receipt]:{id:w.id,at:Date.now(),outcome:"Opened contact"}});window.location.assign(r.url+"?text="+encodeURIComponent(t[w.skill]+" — "+areaLabel(w.locality)));}
  })}><MessageCircle/>{t.contact}</button></article>):<p role="status">{t.empty}</p>;}
  const privacy=<label className="consentGuide"><input type="checkbox" checked={consent} onChange={e=>C(e.target.checked)}/>{t.consent}</label>;
  return <div className="guided" dir={pack.rtl?"rtl":"ltr"}><header><div><button className="gBrand" onClick={()=>navigate("/")}><Home/>SkillSetu</button><Language code={pack.code} change={change}/></div></header><main>
    <div className="guideTop">{phase!=="home"&&<button onClick={back}><ChevronLeft/>{t.back}</button>}{!live&&<small>{t.local}</small>}</div>
    <h1 tabIndex="-1" ref={heading}>{title}</h1><AudioGuide pack={pack} words={words} speaker={speaker}/>
    {err&&<p role="alert">{t.retry} · {err} <button onClick={()=>R(tick+1)}>{t.retry}</button></p>}
    {!waiting&&(!err||busy||phase==="review")&&<div className="guideBody">
    {isGate?<React.Suspense fallback={<p>{t.loading}</p>}><Auth ready={U} pack={pack}/></React.Suspense>:id||phase==="results"?cards():dash?(own?<><h2>{own.name}</h2><p>{t[own.skill]} · {areaLabel(own.locality)}</p>{own.listed===false&&privacy}<button disabled={busy||(own.listed===false&&!consent)} onClick={()=>listing(own.listed===false)}>{own.listed===false?t.show:t.pause}</button><Tile icon={UserRound} onClick={()=>navigate("/register")}>{t.join}</Tile></>:<Tile icon={UserRound} onClick={()=>navigate("/register")}>{t.join}</Tile>):phase==="home"?<div className="guideGrid">{[["find","/search",Search],["join","/register",Hand],["post","/post-job",ClipboardList],["dashboard","/dashboard",UserRound]].map(([k,p,i])=><Tile key={k} icon={i} onClick={()=>navigate(p)}>{t[k]}</Tile>)}</div>
    :phase==="name"?<form onSubmit={e=>{e.preventDefault();T("trade");}}><input aria-label={t.name} autoComplete="name" required maxLength={50} value={name} onChange={e=>N(e.target.value)}/><button disabled={!name.trim()}>{t.next}<ArrowRight/></button></form>
    :phase==="trade"?<div className="guideGrid">{tiles(config.skills,v=>{S(v);T("area");},tradeIcons)}</div>
    :phase==="area"?<div className="guideGrid areas">{tiles(areaChoices,v=>{A(v);if(search){navigate("/search?"+new URLSearchParams({skill,locality:v,...(query.get("demo")==="1"?{demo:"1"}:{})}));T("results");}else T(job?"request":"review");})}</div>
    :phase==="request"?<form onSubmit={e=>{e.preventDefault();T("review");}}><p>{t[skill]} · {areaLabel(area)}</p><textarea aria-label={t.request} maxLength={500} value={description} onChange={e=>D(e.target.value)}/><button>{t.next}<ArrowRight/></button></form>
    :phase==="review"?<><p>{join&&name+" · "}{t[skill]} · {areaLabel(area)}</p>{job?<><p>{description}</p><p>{t.phone} · <bdi>{user.phoneNumber}</bdi></p></>:privacy}<button disabled={busy} onClick={submit}><Check/>{job?t.post:consent?t.publish:t.private}</button></>
    :phase==="done"?<Tile icon={Home} onClick={()=>navigate("/")}>{t.home}</Tile>:null}</div>}
    <footer><button lang="en" onClick={exit}>Full version · English</button></footer></main></div>;
}
export { Language };
