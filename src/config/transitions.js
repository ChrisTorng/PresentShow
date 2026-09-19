export function normalizeTransition(value,previous={type:'fade',duration:0.1}){
  if(value==null || value==='keep')return {...previous};
  const result=typeof value==='number'?{type:'fade',duration:value}:{...previous,...value};
  if(!['none','fade'].includes(result.type) || !Number.isFinite(result.duration) || result.duration<0 || result.duration>5)throw new Error('transition 需指定 type: fade/none 與 0–5 秒的 duration。');
  return result;
}
