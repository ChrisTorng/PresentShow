import {sectionTarget} from '../config/songs.js';
export class CueNavigation {
  #history=[];
  constructor(){this.iterations=new Map();this.reset();}
  get previous(){return this.#history.at(-1)?.index??null;}
  clearHistory(){this.#history=[];}
  remapHistory(map,current){
    const history=[];
    for(const entry of this.#history){
      const index=map(entry.index);
      if(index===null)continue;
      if(history.at(-1)?.index===index)history.pop();
      history.push({...entry,index});
    }
    if(history.at(-1)?.index===current)history.pop();
    this.#history=history;
  }
  reset(){this.pending=null;this.last=null;}
  next(items,index){return this.pending ?? items[index]?.loopNext ?? (items[index]?.seconds && items[index]?.autoNext!=null?items[index].autoNext:Math.min(index+1,items.length-1));}
  iteration(items,index){return this.iterations.get(items[index]?.loopGroup)||1;}
  nextIteration(items,index,target=this.next(items,index)){
    if(!items[target]?.loopGroup||items[target].loopGroup!==items[index]?.loopGroup)return 1;
    return this.iteration(items,index)+(items[index].loopNext===target?1:0);
  }
  advance(items,from,to,returning=false){
    if(returning){
      const entry=this.#history.pop();
      const group=items[to]?.loopGroup;
      if(group)this.iterations.set(group,entry.iteration);
      return;
    }
    if(from!==to)this.#history.push({index:from,iteration:this.iteration(items,from)});
    const group=items[to]?.loopGroup;
    if(group){
      if(items[from]?.loopGroup!==group)this.iterations.set(group,1);
      else if(items[from]?.loopNext===to)this.iterations.set(group,this.iteration(items,from)+1);
    }
  }
  target(items,index,key){
    const anchor=this.pending!==null && items[this.pending]?.song?.instance===items[index]?.song?.instance?this.pending:index;
    return sectionTarget(items,anchor,key);
  }
  click(index){this.last=null;if(this.pending===index){this.reset();return index;}this.pending=index;return null;}
  shortcut(items,index,key,now){
    const upper=key.toUpperCase();
    if(key===upper){const target=sectionTarget(items,index,upper);if(target!==null)this.reset();return target;}
    if(this.last?.key===key && now-this.last.time<=320 && this.pending===this.last.target){const target=this.pending;this.reset();return target;}
    const target=this.target(items,index,key);if(target===null)return null;
    this.pending=target;this.last={key,time:now,target};return null;
  }
}
