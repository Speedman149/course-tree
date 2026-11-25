import {createFeedbackHandler} from '../server/feedback.ts';
const feedback=createFeedbackHandler({env:{},http:async()=>{throw new Error('Real mail disabled in browser fixture');},log:()=>{}});
import {serveFeedback} from '../server/feedback-node.ts';
import {createServer} from 'node:http';
import {readFile, realpath, stat} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = await realpath(fileURLToPath(new URL('../dist', import.meta.url)));
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const port = Number(process.env.PORT ?? 4173);
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.xml':'application/xml', '.txt':'text/plain', '.svg':'image/svg+xml', '.woff':'font/woff', '.woff2':'font/woff2', '.png':'image/png'};
function conditionMatches(condition, request) {
  if (condition.type !== 'host') throw new Error('Unsupported fixture header condition');
  const hostname = new URL('http://' + (request.headers.host ?? 'localhost')).hostname;
  return new RegExp(`^(?:${condition.value})$`, 'i').test(hostname);
}
/** Production fixture exercises checked-in route/header rules, including host-based preview protection. */
createServer(async (request, response) => {
  for (const rule of config.headers) {
    if (rule.source !== '/(.*)') throw new Error('Unsupported fixture header source');
    if (!(rule.has ?? []).every(condition=>conditionMatches(condition,request)) ||
        (rule.missing ?? []).some(condition=>conditionMatches(condition,request))) continue;
    for (const header of rule.headers) response.setHeader(header.key,header.value);
  }
  try {
    if(new URL(request.url,'http://localhost').pathname==='/api/feedback'){await serveFeedback(request,response,feedback);return;}
    if (request.method !== 'GET' && request.method !== 'HEAD') {response.writeHead(405).end();return;}
    let path = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const rewrite = config.rewrites.find(rule=>rule.source===path);
    if (rewrite) path=rewrite.destination;
    if (path==='/') path='/index.html';
    const file=await realpath(resolve(root,'.'+path));
    if (!file.startsWith(root+sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    response.setHeader('Content-Type',(types[extname(file)] ?? 'application/octet-stream')+(['.html','.js','.css','.json','.xml','.txt','.svg'].includes(extname(file))?'; charset=utf-8':''));
    response.writeHead(200);response.end(request.method==='HEAD'?undefined:await readFile(file));
  } catch {
    const notFound=await readFile(resolve(root,'404.html')).catch(()=>Buffer.from('Not found'));
    response.writeHead(404,{'Content-Type':'text/html; charset=utf-8'}).end(request.method==='HEAD'?undefined:notFound);
  }
}).listen(port,'127.0.0.1',()=>console.log('Production test fixture on http://127.0.0.1:'+port));
