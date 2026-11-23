import {useEffect, useState} from 'react';

export const MOBILE_LAYOUT_QUERY = '(max-width: 640px)';

/** One breakpoint for the tree controls and the footer's mobile presentation. */
export function useMobileLayout() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_LAYOUT_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return mobile;
}
