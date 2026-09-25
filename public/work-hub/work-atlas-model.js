/* Shared, deterministic work graph. No network or persistence side effects. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.WorkAtlasModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const stages = [
    { id: 'expected', label: '예상 할 일', icon: '◇', color: '#a78bce' },
    { id: 'todo', label: '해야 할 일', icon: '○', color: '#d1b177' },
    { id: 'doing', label: '진행 중', icon: '◐', color: '#7daeb8' },
    { id: 'blocked', label: '이슈 · 대기', icon: '!', color: '#da8e85' },
    { id: 'done', label: '완료', icon: '✓', color: '#8cb99b' },
  ];
  const dependencies = item => Array.isArray(item.dependsOn) ? [...new Set(item.dependsOn.filter(id => typeof id === 'string'))] : [];
  function stage(item) {
    if (item.status === 'done') return 'done';
    if (item.status === 'blocked' || item.status === 'failed') return 'blocked';
    if (item.status === 'doing') return 'doing';
    return item.intent === 'expected' ? 'expected' : 'todo';
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(+date) && date.toISOString().slice(0, 10) === value;
  }
  function shift(value, days) {
    const date = new Date(value + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function due(item) {
    if (validDate(item.dueDate)) return item.dueDate;
    if (validDate(item.target)) return item.scope === 'weekly' ? shift(item.target, 6) : item.target;
    if (item.scope === 'monthly' && /^\d{4}-(0[1-9]|1[0-2])$/.test(item.target || '')) {
      const [year, month] = item.target.split('-').map(Number);
      return new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10);
    }
    return '';
  }
  function waiting(item, items) {
    const index = new Map(items.map(t => [t.id, t]));
    return dependencies(item).filter(id => index.get(id)?.status !== 'done');
  }
  function canLink(items, itemId, prerequisiteId) {
    if (!prerequisiteId) return true;
    if (itemId === prerequisiteId || !items.some(t => t.id === prerequisiteId)) return false;
    const index = new Map(items.map(t => [t.id, t]));
    const visited = new Set();
    const stack = [prerequisiteId];
    while (stack.length) {
      const id = stack.pop();
      if (id === itemId) return false;
      if (visited.has(id)) continue;
      visited.add(id);
      stack.push(...dependencies(index.get(id) || {}));
    }
    return true;
  }
  function filter(items, options, today) {
    return items.filter(item => {
      const end = due(item);
      if (options.category && item.category !== options.category) return false;
      if (options.stage && stage(item) !== options.stage) return false;
      if (options.query && !`${item.title} ${item.category || ''} ${item.note || ''}`.toLocaleLowerCase().includes(options.query.toLocaleLowerCase())) return false;
      if (options.period === 'week' && (!end || end < today || end > shift(today, 6))) return false;
      if (options.period === 'overdue' && (!end || end >= today || stage(item) === 'done')) return false;
      return true;
    }).sort((a, b) => (due(a) || '9999').localeCompare(due(b) || '9999') || String(a.title).localeCompare(String(b.title), 'ko'));
  }
  function summary(items, today) {
    return {
      expected: items.filter(t => stage(t) === 'expected').length,
      active: items.filter(t => !['expected', 'done'].includes(stage(t))).length,
      overdue: items.filter(t => stage(t) !== 'done' && due(t) && due(t) < today).length,
      ready: items.filter(t => stage(t) === 'todo' && !waiting(t, items).length),
      done: items.filter(t => stage(t) === 'done').length,
    };
  }
  return { stages, dependencies, stage, due, validDate, shift, waiting, canLink, filter, summary };
});
