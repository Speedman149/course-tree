import {loadEnv,type Plugin} from 'vite';
import {createFeedbackHandler} from '../server/feedback';
import {serveFeedback} from '../server/feedback-node';
/** Server-only development bridge; no environment variables are exposed through Vite's define. */
export function feedbackDevPlugin():Plugin{
 return {name:'branchquest-feedback-development',configureServer(server){
  const env={...process.env,...loadEnv(server.config.mode,server.config.root,'')};
  const handler=createFeedbackHandler({env});
  server.middlewares.use((request,response,next)=>{
   if(new URL(request.url??'/','http://localhost').pathname!=='/api/feedback')return next();
   void serveFeedback(request,response,handler);
  });
 }};
}
