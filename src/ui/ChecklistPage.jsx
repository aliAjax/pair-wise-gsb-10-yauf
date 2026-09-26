import React, { useState } from 'react';
import { createChecklist, checklistStats } from '../logic/verify.js';

const ICON = { router: '◉', switch: '▦', server: '▣', device: '▱' };
const fmt = (ts) => new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function ChecklistPage({ topo, checklists, versions, onCreate, onOpen, onDelete }) {
  const [picked, setPicked] = useState(() => new Set(topo.nodes.map((n) => n.id)));
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const toggle = (id) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };

  const submit = () => {
    if (!picked.size) {
      setErr('请至少选择一台设备');
      return;
    }
    const list = createChecklist(topo, {
      title: title.trim(),
      nodeIds: [...picked],
      basedOnVersion: versions[0]?.no || 1,
    });
    list.note = note.trim();
    onCreate(list);
  };

  const open = checklists.filter((l) => l.status === 'open');
  const closed = checklists.filter((l) => l.status === 'closed');

  return (
    <div className="cl-page">
      <section className="cl-new">
        <div className="cl-card">
          <h2>新建现场核对单</h2>
          <p className="cl-sub">从图上勾选本次要核对的设备，建单时会冻结当时的连接与接口写法作为核对依据。核对进度自动保存，关掉页面重开可以接着核。</p>
          <label className="fld">
            <span>核对单名称</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`如 机房换线核对 · ${fmt(Date.now())}`} />
          </label>
          <label className="fld">
            <span>备注（可选）</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="如 三楼机房 A 列换线后核对" />
          </label>
          <div className="pick-head">
            选择设备 <small>已选 {picked.size}/{topo.nodes.length}</small>
            <div className="pick-all">
              <button className="btn text" onClick={() => setPicked(new Set(topo.nodes.map((n) => n.id)))}>全选</button>
              <button className="btn text" onClick={() => setPicked(new Set())}>清空</button>
            </div>
          </div>
          <div className="pick-grid">
            {topo.nodes.map((n) => (
              <button key={n.id} className={'pick-item ' + (picked.has(n.id) ? 'on' : '')} onClick={() => toggle(n.id)}>
                <i className={n.type}>{ICON[n.type]}</i>
                <span><strong>{n.name}</strong><small>{n.ip}</small></span>
                <b>{picked.has(n.id) ? '✓' : ''}</b>
              </button>
            ))}
          </div>
          {err && <div className="cl-err">{err}</div>}
          <button className="btn primary big" onClick={submit}>生成待核项并开始核对</button>
        </div>
      </section>

      <section className="cl-lists">
        <h3>进行中的核对单 <small>{open.length} 张</small></h3>
        {!open.length && <div className="cl-empty">没有进行中的核对单</div>}
        {open.map((l) => {
          const s = checklistStats(l);
          return (
            <div key={l.id} className="cl-row open">
              <div className="cl-row-main" onClick={() => onOpen(l.id)}>
                <strong>{l.title}</strong>
                <small>{fmt(l.createdAt)} 建单 · 基于 V{l.basedOnVersion} · {s.done}/{s.total} 台已核{s.diffItems ? ` · ${s.diffItems} 台有差异` : ''}</small>
                <div className="cl-progress"><i style={{ width: `${(s.done / Math.max(1, s.total)) * 100}%` }} /></div>
              </div>
              <button className="btn go" onClick={() => onOpen(l.id)}>接着核 →</button>
              <button className="btn text danger" onClick={() => onDelete(l.id)}>删除</button>
            </div>
          );
        })}

        <h3 className="closed-head">已关单记录 <small>{closed.length} 张 · 旧记录仍可查</small></h3>
        {!closed.length && <div className="cl-empty">还没有关单记录，确认接法关单后会在这里留档</div>}
        {closed.map((l) => {
          const s = checklistStats(l);
          return (
            <div key={l.id} className="cl-row closed">
              <div className="cl-row-main" onClick={() => onOpen(l.id)}>
                <strong>{l.title} <span className="tag ok">{l.newVersion}</span></strong>
                <small>{fmt(l.closedAt)} 关单 · {l.items.length} 台 · {s.diff} 条差异已处理</small>
                {l.note && <small className="cl-note">{l.note}</small>}
              </div>
              <button className="btn go ghost" onClick={() => onOpen(l.id)}>查看明细</button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
