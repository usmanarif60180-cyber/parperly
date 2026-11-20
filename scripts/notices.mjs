import { readFile, readdir, writeFile } from 'node:fs/promises';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));const notices=['Paperly — third-party software notices\nGenerated from the locked dependencies installed for this build.'];
for(const [path,entry] of Object.entries(lock.packages)){
 if(!path.startsWith('node_modules/'))continue;
 try{const files=await readdir(path);const names=files.filter(n=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(n));const heading=`\n\n===== ${path.replace(/^node_modules\//,'')} ${entry.version||''} (${entry.license||'see upstream'}) =====\n`;notices.push(heading);for(const name of names){try{notices.push(await readFile(path+'/'+name,'utf8'))}catch{}}}catch{}
}
await writeFile('apps/web/public/THIRD-PARTY-NOTICES.txt',notices.join('\n'));
