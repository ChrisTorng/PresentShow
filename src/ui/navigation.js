import {sectionTarget} from '../config/songs.js';
export class CueNavigation {
  constructor(){this.iterations=new Map();this.reset();}
  reset(){this.pending=null;this.last=null;}
  next(items,index){return this.pending ?? items[index]?.loopNext ?? (items[index]?.seconds && items[index]?.autoNext!=null?items[index].autoNext:Math.min(index+1,items.length-1));}
  iteration(items,index){return this.iterations.get(items[index]?.loopGroup)||1;}
  nextIteration(items,index,target=this.next(items,index)){
    if(!items[target]?.loopGroup||items[target].loopGroup!==items[index]?.loopGroup)return 1;
    return this.iteration(items,index)+(items[index].loopNext===target?1:0);
  }
  advance(items,from,to){
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
