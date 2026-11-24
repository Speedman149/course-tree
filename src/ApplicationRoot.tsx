import {lazy, StrictMode, Suspense, useEffect, useState} from 'react';
import type {AppRoute} from './lib/navigation';
import {StaticPublicPage} from './components/PublicContent';
const InteractiveApplication=lazy(()=>import('./InteractiveApplication'));
function Bootstrap({initialRoute}:{initialRoute:AppRoute}){
 const [hydrated,setHydrated]=useState(false);
 useEffect(()=>setHydrated(true),[]);
 const initial=<StaticPublicPage route={initialRoute}/>;
 return hydrated?<Suspense fallback={initial}><InteractiveApplication/></Suspense>:initial;
}
/** Identical server/first-client tree; the existing application takes over in matching chrome. */
export default function ApplicationRoot({initialRoute}:{initialRoute:AppRoute}){
 return <StrictMode><Bootstrap initialRoute={initialRoute}/></StrictMode>;
}
