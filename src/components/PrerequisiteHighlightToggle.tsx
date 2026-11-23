import {Check} from 'lucide-react';
import {PREREQUISITE_HIGHLIGHT_LABEL, PREREQUISITE_HIGHLIGHT_SHORT_LABEL} from '../lib/prerequisite-satisfaction';

interface Props {enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean}

export default function PrerequisiteHighlightToggle({enabled, onChange, disabled = false}: Props) {
  return <button type="button" role="switch" className="prerequisite-highlight-toggle" aria-checked={enabled} aria-label={PREREQUISITE_HIGHLIGHT_LABEL} title={`${PREREQUISITE_HIGHLIGHT_LABEL}. אינה אישור זכאות לרישום.`} disabled={disabled} onClick={() => onChange(!enabled)}>
    <span className="prerequisite-highlight-switch" aria-hidden="true"><Check size={12}/></span>
    <span className="prerequisite-highlight-label">{PREREQUISITE_HIGHLIGHT_SHORT_LABEL}</span>
    <span className="prerequisite-highlight-mobile-label">הדגשת קורסים</span>
  </button>;
}
