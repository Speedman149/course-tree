import {useEffect, useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {INDEPENDENT_DISCLAIMER} from '../lib/seo';
import {navigateApp} from '../lib/navigation';

/** CSS chooses the responsive disclosure before JavaScript; no user-agent or crawler branching. */
export default function FooterInformation({aboutHref='/about',navigate=false,mobile}:{aboutHref?:string;navigate?:boolean;mobile?:boolean}){
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>setExpanded(false),[mobile]);
 return <div className="site-footer-main">
  {mobile!==true&&<p className="site-disclaimer desktop-site-disclaimer" lang="en" dir="ltr">{INDEPENDENT_DISCLAIMER}</p>}
  {mobile!==false&&<details className="mobile-site-disclaimer" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary aria-label="גילוי נאות מלא — פרויקט עצמאי שאינו אתר רשמי של הטכניון"><span>פרויקט עצמאי · לא אתר רשמי של הטכניון</span><ChevronDown size={13}/></summary><p className="site-disclaimer" lang="en" dir="ltr">{INDEPENDENT_DISCLAIMER}</p></details>}
  <nav aria-label="קישורי האתר"><a href={aboutHref} onClick={navigate?event=>{event.preventDefault();navigateApp(aboutHref);}:undefined}>אודות / About</a><span className="developer-credit map-developer-credit" dir="ltr">Developed by Chupchick</span></nav>
 </div>;
}
