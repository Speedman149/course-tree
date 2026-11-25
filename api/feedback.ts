import {handleFeedback} from '../server/feedback.js';
// Native Vercel Node.js function. The existing Vite frontend remains a static build.
export default {fetch:handleFeedback};
