export function parseMediaTime(value){
 if(value===undefined||value===null||String(value).trim()==='')return null;
 const text=String(value).trim();let seconds;
 if(/^\d+(?:\.\d+)?$/.test(text))seconds=Number(text);
 else if(/^\d+:\d{1,2}(?:\.\d+)?$/.test(text)){
  const [minutes,remainder]=text.split(':').map(Number);
  if(remainder>=60)throw Error('起播時間的秒數需小於 60。');
  seconds=minutes*60+remainder;
 }else if(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.test(text)){
  const match=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  seconds=Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0);
 }else throw Error('起播時間請填總秒數或分:秒，例如 62 或 1:02。');
 if(!Number.isFinite(seconds)||seconds<0)throw Error('起播時間必須大於等於 0。');
 return seconds;
}
export function mediaStart(media){
 const explicit=parseMediaTime(media.start);
 if(explicit!==null)return explicit;
 try{
  const url=new URL(media.src,'https://local.invalid');
  return parseMediaTime(url.searchParams.get('t')??url.searchParams.get('start')??new URLSearchParams(url.hash.slice(1)).get('t'))??0;
 }catch(error){if(error.message?.startsWith('起播時間'))throw error;return 0;}
}
export const mediaResume=(track,resume)=>resume??track?.start??0;
