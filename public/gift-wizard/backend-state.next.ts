/** UI-independent request state. Does not grant payment, entitlements, approvals, or mutate GiftSession. */
import {GiftApiError} from './backend.next.js';
export type RequestState<T>={status:'idle'}|{status:'loading';previous?:T}|{status:'ready';value:T}|{status:'failed';code:string;httpStatus:number;previous?:T};
export class RequestSlot<T>{
 private current:RequestState<T>={status:'idle'};private epoch=0;private abort?:AbortController;
 get state():RequestState<T>{return structuredClone(this.current)}
 async run(operation:(signal:AbortSignal)=>Promise<T>):Promise<void>{
  this.abort?.abort();const token=++this.epoch,controller=new AbortController();this.abort=controller;
  const previous=this.current.status==='ready'?this.current.value:'previous'in this.current?this.current.previous:undefined;
  this.current={status:'loading',previous};
  try{const result=await operation(controller.signal);if(token===this.epoch)this.current={status:'ready',value:structuredClone(result)}}
  catch(e){if(token===this.epoch)this.current={status:'failed',code:e instanceof GiftApiError?e.code:'request_failed',httpStatus:e instanceof GiftApiError?e.status:0,previous}}
 }
 reset(){this.epoch++;this.abort?.abort();this.current={status:'idle'}}
}
// Retry is an explicit caller action invoking run again. No auto-retry, background poller, localStorage entitlement,
// client-paid flag, or generic replay of a mutation. Restoration always uses GiftBackend.restore.
