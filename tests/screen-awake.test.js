import test from 'node:test';
import assert from 'node:assert/strict';
import {ScreenAwake} from '../src/leader/screen-awake.js';

test('screen wake lock remains held without interaction and is reacquired after returning to visibility',async()=>{
 const events=new Map(),locks=[],states=[];
 const doc={visibilityState:'visible',addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
 const navigator={wakeLock:{async request(type){assert.equal(type,'screen');let released;const lock={addEventListener(name,fn){released=fn;},async release(){released?.();}};locks.push(lock);return lock;}}};
 const awake=new ScreenAwake({document:doc,navigator,onStatus:(text,held)=>states.push(held)});
 await awake.pending;await Promise.resolve();assert.equal(locks.length,1);assert.equal(awake.lock,locks[0]);
 await awake.request();assert.equal(locks.length,1);
 doc.visibilityState='hidden';await locks[0].release();assert.equal(awake.lock,null);
 doc.visibilityState='visible';events.get('visibilitychange')();await awake.pending;await Promise.resolve();
 assert.equal(locks.length,2);assert.equal(awake.lock,locks[1]);assert.equal(states.at(-1),true);
 awake.destroy();assert.equal(events.size,0);
});

test('unsupported browsers keep the page usable and expose the HTTPS requirement',()=>{
 const statuses=[],doc={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
 const awake=new ScreenAwake({document:doc,navigator:{},onStatus:text=>statuses.push(text)});
 assert.match(statuses[0],/HTTPS/);awake.destroy();
});
