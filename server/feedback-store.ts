/** All admission/lease/quota changes are one atomic Redis operation, shared by every instance. */
export const ADMIT_FEEDBACK = `
local globalAttempts = redis.call('INCR', KEYS[6])
if globalAttempts == 1 then redis.call('EXPIRE', KEYS[6], 600) end
if globalAttempts > 200 then return {'limited', math.max(1, redis.call('TTL', KEYS[6]))} end
local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then redis.call('EXPIRE', KEYS[2], 60) end
if attempts > 15 then return {'limited', math.max(1, redis.call('TTL', KEYS[2]))} end
local fingerprint = redis.call('HGET', KEYS[1], 'fingerprint')
local time = redis.call('TIME')
local now = tonumber(time[1])
if fingerprint then
  if fingerprint ~= ARGV[1] then return {'conflict', 0} end
  local status = redis.call('HGET', KEYS[1], 'status')
  if status == 'sent' then return {'duplicate', 0} end
  if status ~= 'pending' and status ~= 'retry' then return {'unavailable', 0} end
  if status == 'pending' and tonumber(redis.call('HGET', KEYS[1], 'lease_until') or '0') > now then
    return {'busy', 2}
  end
else
  local limits = {5, 10, tonumber(ARGV[3])}
  local windows = {600, 86400, 86400}
  for i = 1, 3 do
    if tonumber(redis.call('GET', KEYS[i+2]) or '0') >= limits[i] then
      return {'limited', math.max(1, redis.call('TTL', KEYS[i+2]))}
    end
  end
  for i = 1, 3 do
    local count = redis.call('INCR', KEYS[i+2])
    if count == 1 then redis.call('EXPIRE', KEYS[i+2], windows[i]) end
  end
  redis.call('HSET', KEYS[1], 'fingerprint', ARGV[1])
  redis.call('EXPIRE', KEYS[1], 86400)
end
redis.call('HSET', KEYS[1], 'status', 'pending', 'token', ARGV[2], 'lease_until', now + 30)
return {'admitted', 0}
`;
export const FINISH_FEEDBACK = `
if redis.call('HGET', KEYS[1], 'token') ~= ARGV[1] then return 0 end
if redis.call('HGET', KEYS[1], 'status') ~= 'pending' then return 0 end
redis.call('HSET', KEYS[1], 'status', ARGV[2], 'lease_until', 0)
redis.call('HDEL', KEYS[1], 'token')
return 1
`;
export type Admission = {status:'admitted'|'duplicate'|'busy'|'conflict'|'limited'|'unavailable'; retryAfter:number};
export interface FeedbackStore {
 admit(keys:string[],fingerprint:string,token:string,dailyLimit:number):Promise<Admission>;
 finish(key:string,token:string,status:'sent'|'retry'):Promise<void>;
}
export class RedisFeedbackStore implements FeedbackStore {
 constructor(private url:string,private token:string,private http:typeof fetch=fetch){}
 private async eval(script:string,keys:string[],args:string[]):Promise<unknown>{
  const response=await this.http(this.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(4000),
   headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},
   body:JSON.stringify(['EVAL',script,String(keys.length),...keys,...args])});
  if(!response.ok)throw new Error('Feedback protection unavailable');
  const body=await response.json() as {result?:unknown;error?:unknown};
  if(!body||typeof body!=='object'||body.error||!Object.hasOwn(body,'result'))throw new Error('Feedback protection unavailable');
  return body.result;
 }
 async admit(keys:string[],fingerprint:string,token:string,dailyLimit:number):Promise<Admission>{
  const result=await this.eval(ADMIT_FEEDBACK,keys,[fingerprint,token,String(dailyLimit)]);
  if(!Array.isArray(result)||result.length!==2||!['admitted','duplicate','busy','conflict','limited','unavailable'].includes(result[0])||!Number.isInteger(result[1])||result[1]<0)throw new Error('Invalid protection response');
  return {status:result[0],retryAfter:result[1]};
 }
 async finish(key:string,token:string,status:'sent'|'retry'){
  if(await this.eval(FINISH_FEEDBACK,[key],[token,status])!==1)throw new Error('Feedback lease unavailable');
 }
}
