export function uiLabels(variables={}){
 const name=(key,fallback)=>typeof variables[key]==='string'&&variables[key].trim()?variables[key].trim():fallback;
 return {leader:name('leaderName','主領'),worship:name('worshipName','敬拜')};
}
export function applyUILabels(root,labels=uiLabels()){
 const fill=text=>text.replace(/\{(leader|worship)\}/g,(_,key)=>labels[key]);
 for(const element of root.querySelectorAll('[data-ui-label]'))element.textContent=fill(element.dataset.uiLabel);
 for(const element of root.querySelectorAll('[data-ui-aria]'))element.setAttribute('aria-label',fill(element.dataset.uiAria));
}
