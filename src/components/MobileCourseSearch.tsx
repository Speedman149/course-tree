import {useEffect,useId,useLayoutEffect,useRef,useState,type ComponentProps} from 'react';
import {createPortal} from 'react-dom';
import {Search,X} from 'lucide-react';
import CourseSearch from './CourseSearch';

type Props=ComponentProps<typeof CourseSearch>;
const MOBILE_QUERY='(max-width: 640px)';

/** Mobile presentation only: CourseSearch owns the existing search and scope behavior. */
export default function MobileCourseSearch(props:Props){
 const [mobile,setMobile]=useState(()=>window.matchMedia(MOBILE_QUERY).matches);
 const [expanded,setExpanded]=useState(false);
 const [bounds,setBounds]=useState({top:71,left:10,width:window.innerWidth-20,height:window.innerHeight-79});
 const toggle=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLDivElement>(null);
 const panelId=useId();
 useEffect(()=>{
  const media=window.matchMedia(MOBILE_QUERY);
  const change=()=>{setMobile(media.matches);setExpanded(false);};
  media.addEventListener('change',change);
  return()=>media.removeEventListener('change',change);
 },[]);
 useLayoutEffect(()=>{
  if(!mobile||!expanded)return;
  const update=()=>{
   const viewport=window.visualViewport;
   const visibleTop=viewport?.offsetTop??0;
   const bottom=visibleTop+(viewport?.height??window.innerHeight);
   const headerBottom=document.querySelector('.app-header')?.getBoundingClientRect().bottom??65;
   const top=Math.min(Math.max(headerBottom+6,visibleTop+8),Math.max(visibleTop+8,bottom-160));
   setBounds({top,left:(viewport?.offsetLeft??0)+10,width:Math.max(0,(viewport?.width??window.innerWidth)-20),height:Math.max(0,bottom-top-8)});
  };
  update();
  window.addEventListener('resize',update);
  window.visualViewport?.addEventListener('resize',update);
  window.visualViewport?.addEventListener('scroll',update);
  return()=>{window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);};
 },[mobile,expanded]);
 useLayoutEffect(()=>{
  if(mobile&&expanded&&!props.disabled)panel.current?.querySelector<HTMLInputElement>('.search-input')?.focus({preventScroll:true});
 },[mobile,expanded,props.disabled]);
 useEffect(()=>{
  if(!expanded)return;
  const outside=(event:Event)=>{if(!panel.current?.contains(event.target as Node)&&!toggle.current?.contains(event.target as Node))setExpanded(false);};
  document.addEventListener('pointerdown',outside);
  document.addEventListener('focusin',outside);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);};
 },[expanded]);
 const close=()=>{setExpanded(false);toggle.current?.focus({preventScroll:true});};
 return <>
  <button ref={toggle} className="mobile-search-toggle" type="button" aria-label="חיפוש קורסים" title="חיפוש קורסים" aria-haspopup="dialog" aria-expanded={expanded} aria-controls={expanded?panelId:undefined} disabled={props.disabled} onClick={()=>expanded?close():setExpanded(true)}><Search size={19} aria-hidden="true"/></button>
  {mobile&&expanded&&createPortal(<div ref={panel} id={panelId} className="mobile-search-panel" role="dialog" aria-label="חיפוש קורסים" dir="rtl" style={{top:bounds.top,left:bounds.left,width:bounds.width,maxHeight:bounds.height}} onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
   <button className="mobile-search-close" type="button" aria-label="סגירת חיפוש הקורסים" title="סגירת החיפוש" onClick={close}><X size={18} aria-hidden="true"/></button>
   <CourseSearch {...props} onSelect={course=>{props.onSelect(course);setExpanded(false);requestAnimationFrame(()=>toggle.current?.focus({preventScroll:true}));}}/>
  </div>,document.body)}
 </>;
}
