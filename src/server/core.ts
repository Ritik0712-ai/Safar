import 'server-only';
import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {Timestamp,FieldPath,type DocumentSnapshot,type Query,type Transaction} from 'firebase-admin/firestore';
import {admin} from '@/lib/firebase/admin';
import type {Account,Role} from '@/contracts';
export class AppError extends Error {constructor(public status:number,public code:string,message:string,public retryable=false){super(message);}}
export function ensure(condition:unknown,status:number,code:string,message:string):asserts condition {if(!condition)throw new AppError(status,code,message);}
export const now=()=>Timestamp.now();
export const future=(ms:number)=>Timestamp.fromMillis(Date.now()+ms);
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function serialize(value:unknown):unknown {if(value instanceof Timestamp)return value.toDate().toISOString();if(Array.isArray(value))return value.map(serialize);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,serialize(v)]));return value;}
export function dto<T>(doc:DocumentSnapshot):T {ensure(doc.exists,404,'NOT_FOUND','This record is unavailable.');return {id:doc.id,...serialize(doc.data()) as object} as T;}
export const base=()=>({schemaVersion:1,version:1,createdAt:now(),updatedAt:now()});
export const updated=(v:number)=>({version:v+1,updatedAt:now()});
export interface Actor {uid:string;email:string;verified:boolean;admin:boolean;account:Account|null;authTime:number}
export async function actor(req:Request):Promise<Actor> {
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');ensure(token,401,'SIGN_IN_REQUIRED','Sign in to continue.');
 let identity;try{identity=await admin().auth.verifyIdToken(token,true);}catch{throw new AppError(401,'SESSION_EXPIRED','Your session expired. Sign in again.');}
 const doc=await admin().db.doc(`users/${identity.uid}`).get();const account=doc.exists?dto<Account>(doc):null;
 ensure(!account||account.accountStatus==='active',403,'ACCOUNT_UNAVAILABLE','Your account is unavailable. Contact support.');
 return {uid:identity.uid,email:identity.email??'',verified:identity.email_verified===true,admin:identity.admin===true&&account?.roles.includes('admin')===true,account,authTime:identity.auth_time};
}
export function role(a:Actor,r:Role,verified=false){ensure(a.account?.roles.includes(r)&&(r!=='admin'||a.admin),403,'WORKSPACE_UNAVAILABLE','This workspace is unavailable for your account.');if(verified)ensure(a.verified,403,'VERIFY_EMAIL','Verify your email before continuing.');}
export function checkVersion(data:{version:number},expected:number){ensure(data.version===expected,409,'STATE_CHANGED','This record changed. Refresh and try again.');}
export async function rate(a:string,op:string,limit:number,ms=60000){const window=Math.floor(Date.now()/ms),ref=admin().db.doc(`rateLimits/${hash(`${a}:${op}:${window}`)}`);await admin().db.runTransaction(async t=>{const d=await t.get(ref);const count=d.data()?.count??0;ensure(count<limit,429,'TOO_MANY_REQUESTS','Too many attempts. Please try again in a minute.');t.set(ref,{schemaVersion:1,scopeHash:hash(a),operation:op,windowStart:Timestamp.fromMillis(window*ms),count:count+1,limit,createdAt:now(),expiresAt:future(ms*2)});});}
export interface Operation {actor:Actor;name:string;key:string;body:unknown}
export function operation(req:Request,a:Actor,name:string,body:unknown):Operation {const key=req.headers.get('idempotency-key');ensure(key&&/^[0-9a-f-]{36}$/i.test(key),400,'IDEMPOTENCY_REQUIRED','A valid request key is required.');return {actor:a,name,key,body};}
export async function atomic<T>(op:Operation,fn:(t:Transaction)=>Promise<T>):Promise<T> {const ref=admin().db.doc(`operations/${hash(`${op.actor.uid}:${op.name}:${op.key}`)}`),bodyHash=hash(JSON.stringify(op.body));return admin().db.runTransaction(async t=>{const old=await t.get(ref);if(old.exists){ensure(old.data()?.bodyHash===bodyHash,409,'KEY_REUSED','This request key was already used for different data.');return old.data()?.responseData as T;}const result=await fn(t);t.create(ref,{schemaVersion:1,actorId:op.actor.uid,operation:op.name,keyHash:hash(op.key),bodyHash,status:'committed',responseData:result,createdAt:now(),updatedAt:now(),expiresAt:future(86400000)});return result;});}
function cursorKey(){const key=process.env.CURSOR_SIGNING_KEY;ensure(key,503,'CONFIGURATION_UNAVAILABLE','Pagination is temporarily unavailable.');return key;}
export function cursorEncode(scope:string,id:string){const p=Buffer.from(JSON.stringify({scope,id})).toString('base64url');return `${p}.${createHmac('sha256',cursorKey()).update(p).digest('base64url')}`;}
export function cursorDecode(cursor:string,scope:string){const [p,s]=cursor.split('.');const sig=createHmac('sha256',cursorKey()).update(p??'').digest('base64url');ensure(s&&s.length===sig.length&&timingSafeEqual(Buffer.from(s),Buffer.from(sig)),400,'INVALID_CURSOR','This page link expired. Refresh the list.');const obj=JSON.parse(Buffer.from(p,'base64url').toString());ensure(obj.scope===scope,400,'INVALID_CURSOR','This page link is unavailable.');return obj.id as string;}
export async function page<T>(query:Query,scope:string,cursor:string|null,order='createdAt',ascending=false){let q=query.orderBy(order,ascending?'asc':'desc').orderBy(FieldPath.documentId(),ascending?'asc':'desc');if(cursor){const id=cursorDecode(cursor,scope),doc=await query.firestore.doc(`${query instanceof Object? '':''}${id}`).get();ensure(doc.exists,400,'INVALID_CURSOR','Refresh this list.');q=q.startAfter(doc);}const snap=await q.limit(21).get(),docs=snap.docs.slice(0,20);return {items:docs.map(d=>dto<T>(d)),nextCursor:snap.size>20?cursorEncode(scope,docs.at(-1)!.ref.path):null};}
export function event(t:Transaction,id:string,version:number,type:string,a:Actor,from:string|null,to:string|null){t.create(admin().db.doc(`rides/${id}/events/${version}-${type}`),{schemaVersion:1,createdAt:now(),eventType:type,actorId:a.uid,actorRole:a.admin?'admin':from===null?'rider':'driver',fromStatus:from,toStatus:to,rideVersion:version,requestId:randomUUID()});}
export function audit(t:Transaction,a:Actor,action:string,id:string,before:string,after:string,reason=''){t.create(admin().db.collection('auditLogs').doc(),{schemaVersion:1,createdAt:now(),actorId:a.uid,action,resourceType:'operation',resourceId:id,beforeState:before,afterState:after,reason,requestId:randomUUID(),environment:process.env.APP_ENV??'development'});}
