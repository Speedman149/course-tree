import {useCallback,useEffect,useRef,useState} from 'react';
import {PROGRESS_KEY,PROGRESS_VERSION,decodeProgress,defaultProgress,encodeProgress,validateProgress,type Progress,type ProgressDatabase} from './progress';

/** Browser-only IO never runs during rendering. Saved sessions wait for both databases; a fresh session can display courses while catalogs load. */
export function useProgress(current: Progress, db: ProgressDatabase, canRestore: boolean, catalogSettled: boolean, restore: (saved: Progress)=>void) {
  const [ready,setReady]=useState(false);
  const [storageAvailable,setStorageAvailable]=useState(true);
  const latest=useRef(current);latest.current=current;
  const database=useRef(db);database.current=db;
  const restoreRef=useRef(restore);restoreRef.current=restore;
  const signature=useRef('');
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const initialized=useRef(false);
  const write=useCallback(()=>{
    const next=JSON.stringify(latest.current);
    if(next===signature.current)return;
    try {localStorage.setItem(PROGRESS_KEY,encodeProgress(latest.current));signature.current=next;setStorageAvailable(true);}catch{setStorageAvailable(false);}
  },[]);
  useEffect(()=>{
    if(!canRestore||initialized.current)return;
    let saved:unknown=null;
    let migrate=false;
    try{
      const stored=localStorage.getItem(PROGRESS_KEY);
      saved=decodeProgress(stored);
      migrate=saved!==null&&stored!==null&&JSON.parse(stored).version!==PROGRESS_VERSION;
    }catch{setStorageAvailable(false);}
    if(saved!==null&&!catalogSettled)return;
    initialized.current=true;
    const restored=validateProgress(saved,database.current,new URLSearchParams(window.location.search).get('course'));
    // Rewrite legacy envelopes once the converted state has reached React.
    signature.current=migrate?'':JSON.stringify(restored);
    restoreRef.current(restored);setReady(true);
  },[canRestore,catalogSettled]);
  const marks=current.markedCourseIds.join(',');
  const previousMarks=useRef(marks);
  useEffect(()=>{
    if(!ready)return;
    clearTimeout(timer.current);
    // Mark/unmark commits immediately. View and filter changes are coalesced;
    // viewport state is supplied only at the end of a pan/zoom interaction.
    if(previousMarks.current!==marks)write();else timer.current=setTimeout(write,300);
    previousMarks.current=marks;
    return ()=>clearTimeout(timer.current);
  },[current,ready,marks,write]);
  useEffect(()=>{
    if(!ready)return;
    const flush=()=>write();
    const hidden=()=>{if(document.visibilityState==='hidden')write();};
    const storage=(event:StorageEvent)=>{
      if(event.key!==PROGRESS_KEY&&event.key!==null)return;
      if(event.newValue!==null&&decodeProgress(event.newValue)===null)return;
      clearTimeout(timer.current);
      const next=validateProgress(decodeProgress(event.newValue),database.current);
      signature.current=JSON.stringify(next);restoreRef.current(next);
    };
    window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hidden);window.addEventListener('storage',storage);
    return ()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('storage',storage);};
  },[ready,write]);
  const clearSaved=useCallback(()=>{
    clearTimeout(timer.current);
    const next=defaultProgress(database.current);signature.current=JSON.stringify(next);
    try{localStorage.removeItem(PROGRESS_KEY);setStorageAvailable(true);}catch{setStorageAvailable(false);}
    restoreRef.current(next);
  },[]);
  return {ready,storageAvailable,clearSaved};
}