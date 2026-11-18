import {createServer} from 'node:http';
import {readFile, realpath, stat} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = await realpath(fileURLToPath(new URL('../dist', import.meta.url)));
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const headers = Object.fromEntries(config.headers.find(rule => rule.source === '/(.*)').headers.map(header => [header.key, header.value]));
const port = Number(process.env.PORT ?? 4173);
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff':'font/woff', '.woff2':'font/woff2', '.png':'image/png'};

/** Local production fixture. It exercises checked-in headers and the two Vercel rewrites. */
createServer(async (request, response) => {
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const rewrite = config.rewrites.find(rule => rule.source === path);
    if (rewrite) path = rewrite.destination;
    if (path === '/') path = '/index.html';
    const file = await realpath(resolve(root, '.' + path));
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    response.setHeader('Content-Type', (types[extname(file)] ?? 'application/octet-stream') + (['.html','.js','.css','.json','.svg'].includes(extname(file)) ? '; charset=utf-8' : ''));
    response.writeHead(200);
    response.end(request.method === 'HEAD' ? undefined : await readFile(file));
  } catch {
    response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log('Production test fixture on http://127.0.0.1:' + port));
