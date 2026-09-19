// New built-in styles declare their defaults here and register a renderer in backgrounds.js.
export const BACKGROUND_STYLES = {
  abstract: {label:'流動色雲',blobs:7,blur:80},
  ribbons: {label:'柔光絲帶',blobs:5,blur:45},
  mist: {label:'晨光霧幕',blobs:9,blur:110},
  'audio-reactive': {label:'靜心音樂律動',blobs:7,blur:100,speed:0.3,motion:0.45},
  solid: {label:'靜態雙色',blobs:0,blur:0},
  image: {label:'背景圖片'},
  video: {label:'循環背景影片'}
};
export const DEFAULT_BACKGROUND = {
  type:'abstract',seed:'sunday-morning',colors:['#fff1d6','#dcefff'],
  deviation:20,speed:1,motion:1,colorMotion:1,blobs:7,blur:80,sensitivity:1,response:0.94
};
export function normalizeBackground(value = {}, id = 'default') {
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error(`背景 ${id} 必須是設定物件。`);
  const type=value.type || 'abstract';
  if(!Object.hasOwn(BACKGROUND_STYLES,type))throw new Error(`背景 ${id}：未知樣式 ${type}。`);
  const result={...DEFAULT_BACKGROUND,...BACKGROUND_STYLES[type],...value,type,id};
  if(!['string','number'].includes(typeof result.seed))throw new Error(`背景 ${id}：seed 必須是文字或數字。`);
  if(!Array.isArray(result.colors) || result.colors.length!==2 || result.colors.some(c=>typeof c!=='string' || !/^#[\da-f]{6}$/i.test(c)))throw new Error(`背景 ${id}：colors 請指定兩個加引號的 #RRGGBB 色碼。`);
  for(const [key,min,max] of [['deviation',0,100],['speed',0,10],['motion',0,3],['colorMotion',0,1],['blur',0,200],['sensitivity',0,4],['response',0,0.99]]){
    if(!Number.isFinite(result[key]) || result[key]<min || result[key]>max)throw new Error(`背景 ${id}：${key} 必須在 ${min} 到 ${max} 之間。`);
  }
  if(!Number.isInteger(result.blobs) || result.blobs<0 || result.blobs>20)throw new Error(`背景 ${id}：blobs 必須是 0–20 的整數。`);
  if(['image','video'].includes(type) && (typeof result.src!=='string' || !result.src))throw new Error(`背景 ${id} 需要 src。`);
  if(result.fit && !['cover','contain'].includes(result.fit))throw new Error(`背景 ${id}：fit 必須是 cover 或 contain。`);
  return result;
}
export function seededRandom(seed) {
  let state=2166136261;
  for(const char of String(seed)){state^=char.charCodeAt(0);state=Math.imul(state,16777619);}
  return ()=>{state+=0x6D2B79F5;let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}
export function mixColor(colors,t) {
  const rgb=colors.map(color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)));
  return '#'+rgb[0].map((n,i)=>Math.max(0,Math.min(255,Math.round(n+(rgb[1][i]-n)*t))).toString(16).padStart(2,'0')).join('');
}
// No clock or Math.random: seed + settings always produce the exact same animation plan.
export function backgroundPlan(config) {
  const random=seededRandom(config.seed), deviation=config.deviation/100;
  const color=()=>mixColor(config.colors,-deviation+random()*(1+2*deviation));
  return Array.from({length:config.blobs},(_,i)=>{
    const initialColor=color(),phase=random(),duration=(28+random()*22)*1000;
    const frames=Array.from({length:4},()=>({
      transform:`translate(${(random()-.5)*85*config.motion}vw, ${(random()-.5)*70*config.motion}vh) rotate(${(random()-.5)*160*config.motion}deg) scale(${1+(random()-.5)*.65*config.motion})`,
      borderRadius:`${30+random()*40}% ${30+random()*40}% ${30+random()*40}% ${30+random()*40}%`,
      backgroundColor:mixColor([initialColor,color()],config.colorMotion),
      opacity:.55+random()*.3
    }));
    frames.push({...frames[0]});
    return {left:random()*100-20,top:random()*100-20,size:55+random()*35,phase,duration,frames,index:i};
  });
}
