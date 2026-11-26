import {Moon,Sun} from 'lucide-react';
/** CSS chooses the icon/action before hydration; the early theme controller handles native clicks. */
export default function ThemeToggle(){
 return <button type="button" className="theme-toggle" data-theme-toggle="">
  <Moon size={18} className="theme-when-light" aria-hidden="true"/><Sun size={18} className="theme-when-dark" aria-hidden="true"/>
  <span className="theme-action theme-when-light">מצב כהה</span><span className="theme-action theme-when-dark">מצב בהיר</span>
  <span className="theme-tooltip" aria-hidden="true"><span className="theme-when-light">מצב כהה</span><span className="theme-when-dark">מצב בהיר</span></span>
 </button>;
}
