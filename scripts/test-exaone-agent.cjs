const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const env = {};
const calls = [];
let reply = { choices: [{ message: { content: '\n\n{"kind":"partner","answer":""}', reasoning_content: 'private reasoning' } }] };
let status = 200;
const fetchMock = async (endpoint, init) => {
  calls.push({ endpoint, body: JSON.parse(init.body), headers: init.headers });
  return { ok: status === 200, json: async () => reply };
};
function load(file, dependencies = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, process: { env },
    require: name => {
      if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name);
      return dependencies[name];
    },
    fetch: fetchMock, AbortController, setTimeout, clearTimeout
  }, { filename: file });
  return module.exports;
}

(async () => {
  const provider = load('src/lib/search/ai-provider.ts');
  assert.equal(provider.getChatProvider(), null);
  env.GROQ_API_KEY = 'groq-test-only';
  assert.equal(provider.getChatProvider().model, 'openai/gpt-oss-120b');
  env.EXAONE_API_KEY = 'exaone-test-only';
  const selected = provider.getChatProvider();
  assert.equal(selected.model, 'k-exaone_v2.5');
  assert.equal(selected.endpoint, 'https://api.exaone.ai/v1/chat/completions');
  const options = provider.completionOptions(selected, true);
  assert.equal(options.reasoning_effort, 'low');
  assert.ok(options.max_tokens >= 4096);
  assert.equal(options.response_format, undefined);
  assert.equal(options.max_completion_tokens, undefined);
  assert.equal(provider.parseAgentJson('```json\n{"kind":"partner"}\n```').kind, 'partner');
  for (const invalid of ['null', '[]', 'true', 'broken']) assert.equal(provider.parseAgentJson(invalid), null);

  const conversation = load('src/lib/search/conversation.ts', { '@/lib/search/ai-provider': provider });
  const json = await conversation.requestPartnerAgentJson('Return JSON', '파트너 조회');
  assert.equal(json.kind, 'partner');
  assert.equal(calls.at(-1).headers.Authorization, 'Bearer exaone-test-only');
  assert.equal(calls.at(-1).body.model, 'k-exaone_v2.5');
  assert.equal(JSON.stringify(json).includes('private reasoning'), false);

  reply = { choices: [{ message: { content: '튠시스템 교육 이력' } }] };
  assert.equal(await conversation.rewriteConversationalSearchQuery('교육은?', [{ role: 'user', content: '튠시스템 조회' }]), '튠시스템 교육 이력');
  const count = calls.length;
  assert.equal(await conversation.rewriteConversationalSearchQuery('튠시스템 조회'), '튠시스템 조회');
  assert.equal(calls.length, count);
  status = 429;
  assert.equal(await conversation.requestPartnerAgentJson('Return JSON', '조회'), null);
  status = 200;
  delete env.EXAONE_API_KEY;
  await conversation.requestPartnerAgentJson('Return JSON', '조회');
  assert.equal(calls.at(-1).endpoint, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(calls.at(-1).body.response_format.type, 'json_object');
  console.log('PASS: provider selection, EXAONE payload, JSON validation, follow-up context, reasoning isolation, rate-limit search fallback, Groq compatibility');
})().catch(error => { console.error(error); process.exitCode = 1; });
