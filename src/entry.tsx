import { createRoot } from 'react-dom/client';
import QiluoDemo from './qiluo-demo-ui';
import { useState } from 'react';
import ChapterOne from './chapter-one-ui';
declare global {interface Window {__QILUO_ASSETS__:Record<string,string>}}
function App(){const [sandbox,setSandbox]=useState(false);return sandbox?<><button className="ch-back-chapter" onClick={()=>setSandbox(false)}>← 第一章 · 风球之下</button><QiluoDemo/></>:<ChapterOne onSandbox={()=>setSandbox(true)}/>}
createRoot(document.getElementById('root')!).render(<App />);
