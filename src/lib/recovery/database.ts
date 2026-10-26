import 'server-only';
import postgres from 'postgres';
let db: ReturnType<typeof postgres> | undefined;
export function recoveryEnabled(){ return process.env.CONNECT_NATIVE_RECOVERY === 'true'; }
export function database(){
 if(db)return db;
 const raw=process.env.CONNECT_DATABASE_URL;
 if(!raw)throw new Error('DATABASE_NOT_CONFIGURED');
 const url=new URL(raw); const project='mtpnkedvqenddwciazce';
 if(!['postgres:','postgresql:'].includes(url.protocol)|| !(url.hostname===`db.${project}.supabase.co` || (/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)&&decodeURIComponent(url.username).endsWith('.'+project))))throw new Error('DATABASE_URL_INVALID');
 for(const k of ['sslmode','ssl','sslcert','sslkey','sslrootcert'])url.searchParams.delete(k);
 db=postgres(url.toString(),{max:3,prepare:false,connect_timeout:10,idle_timeout:10,ssl:{rejectUnauthorized:true,...(process.env.CONNECT_DB_CA_PEM?{ca:process.env.CONNECT_DB_CA_PEM}:{})},connection:{statement_timeout:15000,application_name:'connect-native-recovery'},onnotice:()=>undefined});
 return db;
}
