import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.EXAMROOM_PORT||8765);
const routes=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/style.css','style.css'],['/core.mjs','core.mjs'],['/demo.json','demo.json'],['/retake.json','retake.json']]);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.jpeg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-cache');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
  let route;
  try{route=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
  let target;
  if(routes.has(route))target=path.join(root,'web',routes.get(route));
  else if(/^\/assets\/(fe|retake)\/[\w-]+\.(jpg|jpeg|png|webp)$/.test(route))target=path.join(root,'..',route.split('/')[2]==='fe'?'FE':'retake',path.basename(route));
  else{res.writeHead(404);res.end('Not found');return;}
  try{const content=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)],'Content-Length':content.length});res.end(req.method==='HEAD'?undefined:content);}
  catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?`Port ${port} is busy. Close the existing Examroom server or set EXAMROOM_PORT.`:err.message);process.exitCode=1;});
server.listen(port, '0.0.0.0', () => console.log(`Examroom: http://127.0.0.1:${port} (hoặc http://localhost:${port})`));
