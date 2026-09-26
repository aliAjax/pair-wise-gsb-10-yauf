import React, { useRef, useState } from 'react';
import { normEdge, otherEnd, portAt } from '../logic/edges.js';

const ICON = { router: '◉', switch: '▦', server: '▣', device: '▱' };

export default function EditorPage({ data, onChange, onValidate, notice }) {
  const [selected, setSelected] = useState('gw');
  const [tool, setTool] = useState('select');
  const [drag, setDrag] = useState(null);
  const board = useRef();

  const node = data.nodes.find((n) => n.id === selected) || data.nodes[0];
  const edges = data.edges.map(normEdge);

  const updateNode = (k, v) =>
    onChange({ ...data, nodes: data.nodes.map((n) => (n.id === selected ? { ...n, [k]: v } : n)) });

  const addNode = (type = 'device', label = '新设备') => {
    const id = 'node' + Date.now();
    const n = { id, name: label, type, x: 500, y: 300, ip: '192.168.0.10' };
    onChange({ ...data, nodes: [...data.nodes, n] });
    setSelected(id);
    setTool('select');
  };

  const connect = () => {
    if (!selected) return;
    const other = prompt('输入要连接的设备 ID（例如 sw1）');
    if (
      other &&
      data.nodes.some((n) => n.id === other) &&
      other !== selected &&
      !edges.some((e) => otherEnd(e, selected) === other)
    ) {
      onChange({ ...data, edges: [...data.edges, { from: selected, to: other }] });
    }
  };

  const remove = () => {
    onChange({
      ...data,
      nodes: data.nodes.filter((n) => n.id !== selected),
      edges: data.edges.map(normEdge).filter((e) => e.from !== selected && e.to !== selected).map((e) =>
        e.fromPort || e.toPort || e.label ? e : [e.from, e.to]
      ),
    });
    setSelected(data.nodes.find((n) => n.id !== selected)?.id);
  };

  // 在属性面板里直接补图上接口/标签写法（核对关单后新版本也是这个数据结构）
  const updateEdge = (peerId, patch) => {
    // patch 语义：{ localPort } 改本端接口；{ label } 改线缆标签
    const next = data.edges.map((raw) => {
      const e = normEdge(raw);
      if (otherEnd(e, selected) !== peerId) return raw;
      if (patch.localPort !== undefined) {
        return e.from === selected ? { ...e, fromPort: patch.localPort } : { ...e, toPort: patch.localPort };
      }
      return { ...e, label: patch.label };
    });
    onChange({ ...data, edges: next });
  };

  const move = (e) => {
    if (!drag || !board.current) return;
    const r = board.current.getBoundingClientRect();
    onChange({
      ...data,
      nodes: data.nodes.map((n) =>
        n.id === drag ? { ...n, x: Math.max(35, e.clientX - r.left), y: Math.max(35, e.clientY - r.top) } : n
      ),
    });
  };

  return (
    <div className="editor-view">
      <div className="toolbar">
        <div className="tool-group">
          <span>工具</span>
          <button className={tool === 'select' ? 'on' : ''} onClick={() => setTool('select')}>↖ 选择</button>
          <button className={tool === 'connect' ? 'on' : ''} onClick={() => { setTool('connect'); connect(); }}>⌁ 连接</button>
          <button onClick={() => addNode()}>＋ 设备</button>
        </div>
        <div className="tool-group zoom">
          <button>−</button><span>100%</span><button>＋</button>
        </div>
      </div>
      <div className="workspace">
        <aside className="inventory">
          <div className="section-title"><span>设备库</span><small>{data.nodes.length} 个节点</small></div>
          <div className="device-types">
            {[['router', '◉', '路由器'], ['switch', '▦', '交换机'], ['server', '▣', '服务器'], ['device', '▱', '终端设备']].map(([t, i, l]) => (
              <button onClick={() => addNode(t, l)} key={t}><i className={t}>{i}</i>{l}<span>＋</span></button>
            ))}
          </div>
          <div className="section-title nodes-head"><span>图中节点</span><small>点击查看</small></div>
          <div className="node-list">
            {data.nodes.map((n) => (
              <button className={selected === n.id ? 'sel' : ''} onClick={() => setSelected(n.id)} key={n.id}>
                <i className={n.type}>{ICON[n.type]}</i>
                <span><strong>{n.name}</strong><small>{n.ip}</small></span>
                <b>›</b>
              </button>
            ))}
          </div>
        </aside>

        <section className="canvas-wrap">
          <div className="canvas" ref={board} onMouseMove={move} onMouseUp={() => setDrag(null)}>
            {edges.map((e, i) => {
              const n1 = data.nodes.find((n) => n.id === e.from);
              const n2 = data.nodes.find((n) => n.id === e.to);
              if (!n1 || !n2) return null;
              const dx = n2.x - n1.x, dy = n2.y - n1.y, len = Math.hypot(dx, dy), ang = (Math.atan2(dy, dx) * 180) / Math.PI;
              return (
                <div className="edge" key={i} style={{ left: n1.x, top: n1.y, width: len, transform: `rotate(${ang}deg)` }}>
                  <span></span>
                </div>
              );
            })}
            {data.nodes.map((n) => (
              <button
                className={'node ' + n.type + (selected === n.id ? ' picked' : '')}
                style={{ left: n.x - 42, top: n.y - 31 }}
                onMouseDown={(e) => { e.stopPropagation(); setSelected(n.id); setDrag(n.id); }}
                onClick={() => setSelected(n.id)}
                key={n.id}
              >
                <i>{ICON[n.type]}</i>
                <strong>{n.name}</strong>
                <small>{n.ip}</small>
              </button>
            ))}
            <div className="legend">
              <span><i className="router"></i>路由器</span>
              <span><i className="switch"></i>交换机</span>
              <span><i className="server"></i>服务器</span>
            </div>
          </div>
          <div className="canvas-footer">
            <span>拖动节点调整位置 · {edges.length} 条连接</span>
            <span>坐标系：画布局部</span>
          </div>
        </section>

        <aside className="inspector">
          <div className="section-title"><span>属性</span><small>{node?.type}</small></div>
          {node ? (
            <>
              <label>设备名称<input value={node.name} onChange={(e) => updateNode('name', e.target.value)} /></label>
              <label>IP 地址<input value={node.ip} onChange={(e) => updateNode('ip', e.target.value)} /></label>
              <label>设备类型
                <select value={node.type} onChange={(e) => updateNode('type', e.target.value)}>
                  <option value="router">路由器</option>
                  <option value="switch">交换机</option>
                  <option value="server">服务器</option>
                  <option value="device">终端设备</option>
                </select>
              </label>
              <div className="inspector-actions">
                <button onClick={connect}>⌁ 添加连接</button>
                <button className="danger" onClick={remove}>删除设备</button>
              </div>
              <div className="connections">
                <div className="section-title"><span>连接</span><small>{edges.filter((e) => e.from === node.id || e.to === node.id).length} 条</small></div>
                {edges.filter((e) => e.from === node.id || e.to === node.id).map((e, i) => {
                  const peerId = otherEnd(e, node.id);
                  const other = data.nodes.find((n) => n.id === peerId);
                  return (
                    <div className="connection" key={i}>
                      <span className={'mini ' + other?.type}></span>
                      <strong>{other?.name || peerId}</strong>
                      <small>在线</small>
                      <div className="edge-edit">
                        <input
                          title="本端接口（图上写法）"
                          placeholder="本端接口"
                          value={portAt(e, node.id)}
                          onChange={(ev) => updateEdge(peerId, { localPort: ev.target.value })}
                        />
                        <input
                          title="线缆标签编号"
                          placeholder="标签编号"
                          value={e.label || ''}
                          onChange={(ev) => updateEdge(peerId, { label: ev.target.value })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <p>选择一个设备</p>}
        </aside>
      </div>
    </div>
  );
}
