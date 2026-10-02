const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/work-hub/work-atlas-model.js');

test('legacy tasks retain their status; expected tasks are distinct until committed', () => {
  assert.equal(M.stage({status:'todo'}), 'todo');
  assert.equal(M.stage({status:'todo', intent:'expected'}), 'expected');
  assert.equal(M.stage({status:'doing', intent:'expected'}), 'doing');
  assert.equal(M.stage({status:'done', intent:'expected'}), 'done');
  assert.equal(M.stage({status:'failed'}), 'blocked');
});
test('dates use explicit deadlines or scope end; leap years and invalid dates', () => {
  assert.equal(M.due({dueDate:'2026-10-01',scope:'weekly',target:'2026-09-21'}),'2026-10-01');
  assert.equal(M.due({scope:'weekly',target:'2026-09-21'}),'2026-09-27');
  assert.equal(M.due({scope:'monthly',target:'2028-02'}),'2028-02-29');
  assert.equal(M.due({scope:'monthly',target:'2026-02'}),'2026-02-28');
  assert.equal(M.due({dueDate:'2026-02-31'}),'');
  assert.equal(M.due({target:''}),'');
});
test('dependency validation prevents indirect cycles and self references', () => {
  const items=[{id:'a'}, {id:'b',dependsOn:['a']}, {id:'c',dependsOn:['b']}];
  assert.equal(M.canLink(items,'a','c'),false);
  assert.equal(M.canLink(items,'a','a'),false);
  assert.equal(M.canLink(items,'new','missing'),false);
  assert.equal(M.canLink(items,'new','c'),true);
  assert.equal(M.canLink([...items,{id:'x',dependsOn:['y']},{id:'y',dependsOn:['x']}],'new','x'),true);
});
test('missing prerequisites remain pending; completed prerequisites unblock', () => {
  assert.deepEqual(M.waiting({dependsOn:['a','a','missing']},[{id:'a',status:'done'}]),['missing']);
  assert.deepEqual(M.waiting({dependsOn:['a']},[{id:'a',status:'doing'}]),['a']);
});
test('filters combine without mutating existing work data', () => {
  const items=[{id:'old',title:'지난 업무',status:'todo',dueDate:'2026-09-20',category:'조달'},
    {id:'soon',title:'제안서',note:'발표 준비',status:'todo',dueDate:'2026-09-28',category:'파트너'},
    {id:'done',title:'완료',status:'done',dueDate:'2026-09-20'}];
  const snapshot=JSON.stringify(items);
  assert.deepEqual(M.filter(items,{period:'overdue'},'2026-09-26').map(t=>t.id),['old']);
  assert.deepEqual(M.filter(items,{period:'week',category:'파트너',query:'발표'},'2026-09-26').map(t=>t.id),['soon']);
  assert.equal(JSON.stringify(items),snapshot);
  assert.equal(M.summary(items,'2026-09-26').overdue,1);
});
