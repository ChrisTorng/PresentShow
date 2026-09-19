import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
// Deliberate allowlist: private configuration is never part of deployment output.
await rm('dist', { recursive:true, force:true });
await mkdir('dist');
for (const file of ['index.html','projector.html']) await copyFile(file, `dist/${file}`);
await cp('src','dist/src',{recursive:true});
await cp('examples','dist/examples',{recursive:true});
console.log('Static site built in dist/ (private files excluded).');
