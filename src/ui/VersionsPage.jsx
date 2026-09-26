import React, { useState } from 'react';
import MiniCanvas from './MiniCanvas.jsx';

export default function VersionsPage({ versions }) {
  const [selId, setSelId] = useState(versions[0]?.id);
  const v = versions.find((x) => x.id === selId) || versions[0];

  if (!v) return <div className="ver-empty">还没有版本记录</div>;

  return (
    <div className="ver-page">
      <aside className="ver-list">
        <div className="col-head">版本记录 <small>{versions.length} 个</small></div>
        {[...versions].reverse().map((x) => (
          <button key={x.id} className={'ver-item ' + (x.id === v.id ? 'on' : '')} onClick={() => setSelId(x.id)}>
            <b>{x.name}</b>
            <small>{new Date(x.createdAt).toLocaleString('zh-CN')}</small>
            {x.source === 'baseline' ? <em className="vtag base">基线</em> : <em className="vtag">核对单</em>}
          </button>
        ))}
      </aside>
      <section className="ver-detail">
        <div className="ver-meta">
          <div>
            <h2>{v.name} <span className="ver-source">{v.source === 'baseline' ? '图面基线' : '现场核对确认'}</span></h2>
            <small>{new Date(v.createdAt).toLocaleString('zh-CN')} · 来源核对单：{v.checklistTitle || '—'}</small>
          </div>
          {v.changes && (
            <div className="ver-changes">
              本次写入：新增 {v.changes.added.length} · 改动 {v.changes.updated.length} · 删除 {v.changes.removed.length} 处连接
            </div>
          )}
        </div>
        <p className="ver-note">{v.note}</p>
        <MiniCanvas topo={v.snapshot} />
      </section>
    </div>
  );
}
