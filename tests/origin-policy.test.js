import test from 'node:test';
import assert from 'node:assert/strict';
import {validOrigin} from '../cloudflare/origin-policy.js';

test('sync accepts LAN browsers while rejecting public addresses and lookalike hostnames',()=>{
  for(const origin of ['http://192.168.1.103:4173','http://10.0.0.2:4173','http://172.16.0.2:4173','http://172.31.255.254:4173','http://localhost:4173']) assert.equal(validOrigin(origin,{}),true,origin);
  for(const origin of ['http://192.168.1.103.evil.test:4173','http://172.32.0.2:4173','http://8.8.8.8:4173','http://192.168.1.103:4173/path','null',null]) assert.equal(validOrigin(origin,{}),false,origin);
});
