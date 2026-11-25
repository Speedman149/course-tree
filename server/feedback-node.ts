import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
/** Local-only adapter; deployed Vercel Functions receive the native Web Request directly. */
export async function serveFeedback(request:IncomingMessage,response:ServerResponse,handler:(request:Request)=>Promise<Response>){
 const controller=new AbortController();request.once('aborted',()=>controller.abort());
 const headers=new Headers();for(const [key,value] of Object.entries(request.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
 const url=new URL(request.url??'/api/feedback','http://'+(request.headers.host??'localhost'));
 const init={method:request.method,headers,signal:controller.signal,...(!['GET','HEAD'].includes(request.method??'GET')?{body:Readable.toWeb(request) as ReadableStream<Uint8Array>,duplex:'half'}:{})};
 try{const result=await handler(new Request(url,init));response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));}
 catch{response.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:false,errors:[{code:'UNAVAILABLE'}]}));}
}
