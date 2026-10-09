import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../outputs/excel-validation/charts');
const files=new Set(['native-preview.html','chart-cases.xlsx','excel-column.png','excel-line.png','excel-scatter.png']);
const types={'.html':'text/html; charset=utf-8','.png':'image/png','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const server=createServer(async(req,res)=>{
  const name=new URL(req.url,'http://127.0.0.1').pathname.slice(1)||'native-preview.html';
  if(!files.has(name)){res.writeHead(404);res.end();return;}
  try{
    const body=await readFile(path.join(root,name));
    const headers={'Content-Type':types[path.extname(name)],'Content-Length':body.length,'Cache-Control':'no-store'};
    if(name.endsWith('.xlsx'))headers['Content-Disposition']='attachment; filename="chart-cases.xlsx"';
    res.writeHead(200,headers);res.end(body);
  }catch{res.writeHead(500);res.end('Unable to read preview file');}
});
server.listen(0,'127.0.0.1',()=>console.log(`http://127.0.0.1:${server.address().port}/native-preview.html`));
