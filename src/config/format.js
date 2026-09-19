import {load,dump,JSON_SCHEMA} from '../vendor/js-yaml.js';
export function parseConfig(text){
  // JSON_SCHEMA keeps account numbers/dates predictable and refuses executable YAML tags.
  const value=load(text,{schema:JSON_SCHEMA});
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('設定檔必須是 YAML 或 JSON 物件。');
  return value;
}
export function formatConfig(value){return dump(value,{schema:JSON_SCHEMA,lineWidth:-1,noRefs:true,quotingType:'"'});}
