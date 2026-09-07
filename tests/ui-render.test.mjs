import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('The actual chapter homepage renders both playable role cards without crashing',async()=>{
  const folder=await mkdtemp(path.join(process.cwd(),'.ui-render-'));
  const priorWindow=globalThis.window,priorStorage=globalThis.localStorage;
  try{
    const outfile=path.join(folder,'chapter.mjs');
    await build({entryPoints:['src/chapter-one-ui.tsx'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic'});
    globalThis.window={__QILUO_ASSETS__:{'/qiluo-harbour.png':'/qiluo-harbour.png','/wefans-logo.png':'/wefans-logo.png'}};
    globalThis.localStorage={getItem:()=>null};
    const {default:Chapter}=await import(pathToFileURL(outfile).href);
    const html=renderToStaticMarkup(React.createElement(Chapter,{onSandbox:()=>{}}));
    assert.match(html,/先从谁的眼中看/);
    assert.match(html,/ch-role-chen/);assert.match(html,/ch-role-zhao/);
    assert.equal((html.match(/走进第一章/g)||[]).length,2);
    assert.match(html,/新增对白支持自动语音/);
  }finally{
    if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;
    if(priorStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=priorStorage;
    await rm(folder,{recursive:true,force:true});
  }
});
