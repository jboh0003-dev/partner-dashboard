export const RECOVERY_COOKIE = '__Host-connect_recovery';
export type RecoveryUser = { id: string; email: string; role: string; exp: number };
const enc = new TextEncoder();
function base64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function bytes(value: string) { return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0)); }
async function key() { const secret=process.env.CONNECT_SESSION_SECRET; if(!secret || secret.length<48) throw new Error('SESSION_NOT_CONFIGURED'); return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']); }
export async function signRecovery(user: Omit<RecoveryUser,'exp'>) { const payload=base64(enc.encode(JSON.stringify({...user,aud:"connect-native-recovery",exp:Math.floor(Date.now()/1000)+28800}))); return payload+'.'+base64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(),enc.encode(payload)))); }
export async function verifyRecovery(token?: string): Promise<RecoveryUser|null> { try { if(!token || token.length>2048)return null; const [p,s,...rest]=token.split('.'); if(rest.length || !await crypto.subtle.verify('HMAC',await key(),bytes(s),enc.encode(p)))return null; const u=JSON.parse(new TextDecoder().decode(bytes(p))); if(u.aud!=='connect-native-recovery'||typeof u.id!=='string'||typeof u.email!=='string'||u.exp<=Date.now()/1000||u.exp>Date.now()/1000+28800)return null; return u; }catch{return null;} }
