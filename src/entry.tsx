import { createRoot } from 'react-dom/client';
import QiluoDemo from './qiluo-demo-ui';
declare global {interface Window {__QILUO_ASSETS__:Record<string,string>}}
createRoot(document.getElementById('root')!).render(<QiluoDemo />);
