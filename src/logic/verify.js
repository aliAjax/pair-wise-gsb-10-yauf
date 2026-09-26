// 判定层：核对单的全部业务规则都在这里，页面只负责展示和收集输入
import { normEdge, edgeKey, pairKey, incident, otherEnd, portAt } from './edges.js';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// 差异原因的快捷选项（仍可在原因框里补充说明）
export const DIFF_KIND = {
  port: { label: '现场接口不符', hint: '实际面板接口与图上写法不同' },
  label: { label: '标签编号不符', hint: '线缆标签编号与图上记录不同' },
  both: { label: '接口与标签均不符', hint: '' },
  missing: { label: '图上有、现场没有', hint: '现场未找到这根接线' },
  extra: { label: '现场有、图上没有', hint: '现场多出的接线' },
};

// 差异处置方式：accept 改图 / fixed 现场整改，later 只记录不允许关单
export const RESOLUTIONS = [
  { value: 'accept', label: '按现场改图', desc: '确认后的实际接法写入新版本' },
  { value: 'fixed', label: '现场已整改', desc: '现场已按图调整，图面不变' },
  { value: 'later', label: '暂不处理', desc: '保留差异，本次不能关单' },
];

const normPort = (s) => (s || '').trim().toUpperCase().replace(/\s+/g, '');

// 判定单行（图上连接）：match 一致 / diff 不一致 / pending 尚未登记完
export function judgeLink(link) {
  // 图上有、现场没有
  if (link.notFound) return { status: 'diff', kind: 'missing' };
  const hasPort = (link.actualPort || '').trim() !== '';
  const hasLabel = (link.actualLabel || '').trim() !== '';
  if (!hasPort && !hasLabel) return { status: 'pending' };

  // 图上本来没写接口/标签（旧数据）：现场登记的内容没有比对基准，
  // 不算自动差异；值班员确认现场有出入时用 forceDiff 勾选
  const hasDiagramPort = (link.diagramPort || '').trim() !== '';
  const hasDiagramLabel = (link.diagramLabel || '').trim() !== '';
  if (!hasDiagramPort && !hasDiagramLabel && !link.forceDiff) return { status: 'match' };

  const portBad = hasDiagramPort && hasPort && normPort(link.actualPort) !== normPort(link.diagramPort);
  const labelBad = hasDiagramLabel && hasLabel && normPort(link.actualLabel) !== normPort(link.diagramLabel);
  if (link.forceDiff) return { status: 'diff', kind: portBad || labelBad ? (portBad && labelBad ? 'both' : portBad ? 'port' : 'label') : 'other' };
  if (portBad && labelBad) return { status: 'diff', kind: 'both' };
  if (portBad) return { status: 'diff', kind: 'port' };
  if (labelBad) return { status: 'diff', kind: 'label' };
  return { status: 'match' };
}

// 现场新增接线行：填了任意一项就算有效，本质上恒为差异
export function judgeExtra(extra) {
  const filled = (extra.peerId || '').trim() !== '' || (extra.actualPort || '').trim() !== '' || (extra.actualLabel || '').trim() !== '';
  return filled ? { status: 'diff', kind: 'extra' } : { status: 'pending' };
}

export const isDiffRow = (r) => r.status === 'diff';
export const reasonMissing = (row) => !row.reason || !row.reason.trim();
export const resolutionMissing = (row) => !row.resolution;
// “暂不处理”不算处理完成，关单时仍会被拦下
export const resolutionOpen = (row) => !row.resolution || row.resolution === 'later';

// 汇总一台设备的登记进度
export function itemStats(item) {
  const rows = [];
  const pendingLinks = [];
  item.links.forEach((l) => {
    const j = judgeLink(l);
    rows.push({ id: l.key, kind: 'link', ...j, reason: l.reason, resolution: l.resolution, nodeId: item.nodeId, nodeName: item.nodeName });
    if (j.status === 'pending') pendingLinks.push(l);
  });
  item.extras.forEach((x) => {
    const j = judgeExtra(x);
    if (j.status !== 'pending') rows.push({ id: x.id, kind: 'extra', ...j, reason: x.reason, resolution: x.resolution, nodeId: item.nodeId, nodeName: item.nodeName });
  });
  const diffs = rows.filter(isDiffRow);
  const pending = pendingLinks.length;
  const unresolved = diffs.filter((r) => reasonMissing(r) || resolutionMissing(r)).length;
  const open = diffs.filter((r) => !reasonMissing(r) && resolutionOpen(r)).length;
  const rackDone = (item.rack || '').trim() !== '';
  const done = rackDone && pending === 0 && unresolved === 0 && open === 0 && item.links.length > 0;
  return { total: rows.length, pending, diff: diffs.length, unresolved, open, rackDone, done, rows };
}

export function checklistStats(list) {
  const per = list.items.map(itemStats);
  return {
    total: list.items.length,
    done: per.filter((p) => p.done).length,
    diffItems: per.filter((p) => p.diff > 0).length,
    pendingLinks: per.reduce((n, p) => n + p.pending, 0),
    unresolved: per.reduce((n, p) => n + p.unresolved, 0),
    open: per.reduce((n, p) => n + p.open, 0),
  };
}

// 关单前审计：差异没处理完（或设备没核完）不能关单，逐条给出拦阻原因
export function auditClose(list) {
  const blockers = [];
  const noRack = list.items.filter((i) => !(i.rack || '').trim());
  const per = list.items.map((i) => ({ item: i, s: itemStats(i) }));
  const pending = per.reduce((n, p) => n + p.s.pending, 0);
  const unresolved = per.reduce((n, p) => n + p.s.unresolved, 0);
  const open = per.reduce((n, p) => n + p.s.open, 0);

  if (noRack.length) blockers.push(`${noRack.length} 台设备还没登记实际机柜`);
  if (pending) blockers.push(`${pending} 条连接还没登记现场接口/标签`);
  if (unresolved) blockers.push(`${unresolved} 条差异还没写原因或处置方式`);
  if (open) blockers.push(`${open} 条差异标记为“暂不处理”，处理完才能关单`);
  if (!list.items.length) blockers.push('核对单里没有设备');
  return { ok: blockers.length === 0, blockers, stats: checklistStats(list) };
}

// 建单：从图上选设备，把建单时的连接和图上接口/标签快照进每台设备
export function createChecklist(topo, { title, nodeIds, basedOnVersion }) {
  const nodes = topo.nodes.filter((n) => nodeIds.includes(n.id));
  const edges = topo.edges.map(normEdge);
  const nameOf = (id) => topo.nodes.find((n) => n.id === id)?.name || id;
  const items = nodes.map((n) => ({
    nodeId: n.id,
    nodeName: n.name,
    type: n.type,
    rack: '',
    rackPos: '',
    links: incident(edges, n.id).map((e) => {
      const peer = otherEnd(e, n.id);
      return {
        key: edgeKey(e),
        peerId: peer,
        peerName: nameOf(peer),
        diagramPort: portAt(e, n.id),
        diagramLabel: e.label || '',
        actualPort: '',
        actualLabel: '',
        notFound: false,
        forceDiff: false,
        reason: '',
        resolution: '',
      };
    }),
    extras: [],
  }));
  return {
    id: uid(),
    title: title || `现场核对单 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }`,
    createdAt: Date.now(),
    basedOnVersion,
    note: '',
    status: 'open',
    items,
    closedAt: null,
    newVersion: null,
  };
}

// 关单：把确认后的接法落到当前拓扑，生成新版本；返回 { topo, changes }
export function buildNextVersion(topo, list) {
  const edges = topo.edges.map(normEdge);
  // 直接索引同一份边对象，touch 的修改才能落到最终输出
  const byKey = new Map(edges.map((e) => [edgeKey(e), e]));
  const added = [];
  const updated = [];
  const removedKeys = new Set();

  const touch = (key, patch) => {
    const e = byKey.get(key);
    if (!e) return;
    const before = JSON.stringify(e);
    Object.assign(e, patch);
    if (JSON.stringify(e) !== before && !updated.some((u) => u.key === key)) updated.push({ key, label: edgeLabel(e) });
  };
  const edgeLabel = (e) => `${e.from}—${e.to}`;

  list.items.forEach((item) => {
    item.links.forEach((l) => {
      const j = judgeLink(l);
      const e = byKey.get(l.key);
      if (!e) return;
      const isFromSide = e.from === item.nodeId;
      if (j.status === 'match' || (j.status === 'diff' && l.resolution === 'accept')) {
        // 一致的接法固化进新版本；“按现场改图”的差异也用现场值覆盖
        if (!l.notFound) {
          touch(l.key, {
            ...(isFromSide ? { fromPort: l.actualPort.trim() } : { toPort: l.actualPort.trim() }),
            ...(l.actualLabel.trim() ? { label: l.actualLabel.trim() } : {}),
          });
        }
      }
      if (l.notFound && l.resolution === 'accept') removedKeys.add(l.key);
    });
    item.extras.forEach((x) => {
      const j = judgeExtra(x);
      if (j.status === 'diff' && x.resolution === 'accept' && x.peerId && x.peerId !== item.nodeId) {
        const key = pairKey(item.nodeId, x.peerId);
        if (!byKey.has(key) && !removedKeys.has(key)) {
          const e = { from: item.nodeId, to: x.peerId, fromPort: x.actualPort.trim(), toPort: '', label: x.actualLabel.trim() };
          byKey.set(key, e);
          edges.push(e);
          added.push({ key, label: `${item.nodeId}—${x.peerId}` });
        }
      }
    });
  });

  const removed = [];
  const finalEdges = edges.filter((e) => {
    if (removedKeys.has(edgeKey(e))) {
      removed.push({ key: edgeKey(e), label: edgeLabel(e) });
      return false;
    }
    return true;
  });

  return {
    topo: { ...topo, edges: finalEdges },
    changes: { added, removed, updated, count: added.length + removed.length + updated.length },
  };
}
