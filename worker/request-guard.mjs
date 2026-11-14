export async function withDeadline(operation,timeoutMs,code="REQUEST_TIMEOUT"){
  let timer;
  try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error(code),{code})),timeoutMs);})]);}
  finally{clearTimeout(timer);}
}
export function consumeRequestBudget(memory,key,{now=Date.now(),limit=6,windowMs=300000}={}){
  for(const [id,entry] of memory)if(now-entry.since>=windowMs)memory.delete(id);
  const entry=memory.get(key)||{since:now,count:0};
  if(entry.count>=limit)return false;
  entry.count++;memory.set(key,entry);return true;
}
