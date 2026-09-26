// 判定层 —— 连接（边）领域模型
// 图上边有两种写法，统一归一成对象：
//   ['gw','sw1']                              -> 旧格式，无接口信息
//   {from,to,fromPort,toPort,label}           -> 新格式，带面板接口与标签编号
export function normEdge(e) {
  if (Array.isArray(e)) return { from: e[0], to: e[1] };
  return { from: e.from, to: e.to, fromPort: e.fromPort || '', toPort: e.toPort || '', label: e.label || '' };
}

// 无向连接的稳定键：节点 id 排序后拼接，a-b 与 b-a 得到同一个键
export function pairKey(a, b) {
  return [a, b].sort().join('::');
}

export function edgeKey(e) {
  return pairKey(e.from, e.to);
}

export function otherEnd(e, nodeId) {
  return e.from === nodeId ? e.to : e.from;
}

export function portAt(e, nodeId) {
  return e.from === nodeId ? (e.fromPort || '') : (e.toPort || '');
}

// 取某设备在图上的全部连接
export function incident(edges, nodeId) {
  return edges.map(normEdge).filter((e) => e.from === nodeId || e.to === nodeId);
}

// 以稳定键索引边，建版本时用来定位改动的连接
export function indexEdges(edges) {
  const map = new Map();
  edges.map(normEdge).forEach((e) => map.set(edgeKey(e), e));
  return map;
}
