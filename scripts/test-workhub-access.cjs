const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '..');
function load(file, auth) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}).outputText;
  vm.runInNewContext(source, { exports, process: {env:{NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test'}},
    URLSearchParams, require: name => {
      if(name==='@supabase/ssr') return {createServerClient:()=>({auth})};
      if(name.startsWith('@/')) return load(path.join(root,'src',name.slice(2)+'.ts'),auth);
      return require(name);
    }
  });
  return exports;
}
const access=load(path.join(root,'src/lib/auth/work-hub-access.ts'));
const owner=access.WORK_HUB_OWNER_ID, other='00000000-0000-0000-0000-000000000001';
async function request(route, claimed, live=claimed, ip='203.0.113.1') {
  const {middleware}=load(path.join(root,'src/middleware.ts'),{getClaims:async()=>({data:{claims:claimed?{sub:claimed}:null}}),getUser:async()=>({data:{user:live?{id:live}:null},error:live?null:{message:'expired'}})});
  return middleware(new NextRequest('https://example.com'+route,{headers:{'x-forwarded-for':ip}}));
}
(async()=>{
  for(const route of ['/work-hub','/work-hub/index.html','/work-hub/runner.js','/work-hub/renaissance.css','/api/work-hub/market','/api/public/work-hub-holidays']){
    assert(access.isWorkHubPath(route));
    assert.equal((await request(route,other)).status,403,route+' non-owner');
    const response=await request(route,owner);
    assert.equal(response.status,200,route+' owner');
    assert(response.headers.get('cache-control').includes('no-store'));
    const anonymous=await request(route,null);
    assert.equal(anonymous.status,route.startsWith('/api/')?401:307,route+' anonymous');
  }
  assert.equal((await request('/work-hub',owner,other)).status,403,'claims cannot override live Auth');
  assert.equal((await request('/work-hub',owner,null)).status,401,'revoked owner session');
  for(const ip of ['203.0.113.10','198.51.100.25']) assert.equal((await request('/work-hub',owner,owner,ip)).status,200);
  assert.equal((await request('/dashboard',other)).status,200,'Connect users retain dashboard access');
  assert.equal((await request('/partner-apply',null)).status,200,'public partner applications unchanged');
  assert(!access.isWorkHubOwner(other)); assert(!access.isWorkHubOwner(null));
  console.log('PASS 6 protected routes × owner/non-owner/anonymous, no-store, live session, different IPs, existing Connect/public access');
})().catch(error=>{console.error(error);process.exitCode=1;});
