import {embedURL} from '../config/web.js';
export class WebStage{
  constructor(host,onError){this.host=host;this.onError=onError;this.key='';this.frame=null;}
  set(item,active){
    if(item.type!=='web'||!active){this.destroy();return;}
    const source=item.embed===false?item.src:embedURL(item.src);
    if(this.key===source)return;this.destroy();this.key=source;
    const frame=document.createElement('iframe');frame.title=item.label||'報告網頁';frame.allow='fullscreen; autoplay; clipboard-write';frame.allowFullscreen=true;
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-downloads');
    frame.referrerPolicy='strict-origin-when-cross-origin';frame.src=source;
    frame.onerror=()=>this.onError('網頁無法載入，請檢查分享權限或改用原網頁。');
    frame.onload=()=>{if(this.frame===frame)this.focus();};
    this.frame=frame;this.host.replaceChildren(frame);this.host.hidden=false;this.onError('');this.focus();
  }
  focus(){this.frame?.focus?.();try{this.frame?.contentWindow?.focus();}catch{/* Cross-origin browsers may deny window focus; outer shortcuts remain disabled. */}}
  destroy(){this.key='';this.host.hidden=true;this.frame?.remove();this.frame=null;}
}
