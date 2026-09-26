import React, { useMemo, useState } from 'react';
import { DIFF_KIND, RESOLUTIONS, judgeLink, judgeExtra, itemStats, auditClose, reasonMissing } from '../logic/verify.js';

const KIND_ITEMS = Object.entries(DIFF_KIND).map(([value, k]) => ({ value, label: k.label }));
const ICON = { router: '◉', switch: '▦', server: '▣', device: '▱' };

const STATUS_TEXT = { match: '一致', diff: '差异', pending: '待登记' };

export default function RunnerPage({ list, topo, onUpdate, onClose, onGoVersions }) {
  const readOnly = list.status === 'closed';
  const per = useMemo(() => list.items.map((item) => ({ item, stats: itemStats(item) })), [list]);
  const doneCount = per.filter((p) => p.stats.done).length;
  const [activeId, setActiveId] = useState(list.items[0]?.nodeId);
  const [attempted, setAttempted] = useState(false);
  const audit = auditClose(list);

  const active = per.find((p) => item.nodeId === activeId) || per[0];
  if (!active) return <div className="runner-empty">核对单中没有设备</div>;
  const { item } = active;
  const itemIndex = list.items.findIndex((i) => i.nodeId === item.nodeId);

  const mutateItem = (fn) => {
    const items = list.items.map((it, idx) => (idx === itemIndex ? fn(it) : it));
    onUpdate({ ...list, items });
  };
  const mutateLink = (linkKey, patch) =>
    mutateItem((it) => ({ ...it, links: it.links.map((l) => (l.key === linkKey ? { ...l, ...patch } : l)) }));
  const mutateExtra = (extraId, patch) =>
    mutateItem((it) => ({ ...it, extras: it.extras.map((x) => (x.id === extraId ? { ...x, ...patch } : x)) }));

  const addExtra = () =>
    mutateItem((it) => ({
      ...it,
      extras: [...it.extras, { id: Math.random().toString(36).slice(2), peerId: '', actualPort: '', actualLabel: '', reason: '', reasonKind: 'extra', resolution: '' }],
    }));
  const removeExtra = (id) => mutateItem((it) => ({ ...it, extras: it.extras.filter((x) => x.id !== id) }));

  const tryClose = () => {
    setAttempted(true);
    if (audit.ok) onClose();
  };

  // 差异区行（右侧）：同一行在这里与设备卡片里联动修改
  const diffRows = per.flatMap(({ item: it, stats }) =>
    stats.rows.filter((r) => r.status === 'diff').map((r) => ({ ...r, item: it }))
  );
  const findRow = (it, r) =>
    r.kind === 'extra' ? it.extras.find((x) => x.id === r.id) : it.links.find((l) => l.key === r.id);

  return (
    <div className="runner">
      <div className="runner-bar">
        <div className="runner-title">
          <strong>{list.title}</strong>
          {readOnly ? (
            <span className="badge closed">已关单 · {list.newVersion || '未生成版本'}</span>
          ) : (
            <span className="badge open">核对中</span>
          )}
        </div>
        <div className="runner-progress">
          已核 {doneCount}/{list.items.length} 台 · 差异 {diffRows.length} 条
        </div>
        <div className="runner-actions">
          {readOnly ? (
            <button className="btn ghost" onClick={onGoVersions}>查看版本记录</button>
          ) : (
            <button className={'btn primary' + (attempted && !audit.ok ? ' blocked' : '')} onClick={tryClose}>确认接法并关单</button>
          )}
        </div>
      </div>

      {attempted && !audit.ok && (
        <div className="blockers">
          <strong>暂时不能关单：</strong>
          {audit.blockers.map((b, i) => (
            <span key={i} className="blocker">· {b}</span>
          ))}
        </div>
      )}

      <div className="runner-body">
        {/* 左：待核设备清单 */}
        <aside className="r-col r-devices">
          <div className="col-head">待核设备 <small>{doneCount}/{list.items.length} 已核</small></div>
          {per.map(({ item: it, stats }) => (
            <button key={it.nodeId} className={'r-device ' + (it.nodeId === item.nodeId ? 'on' : '') + (stats.done ? ' is-done' : stats.diff ? ' has-diff' : '')} onClick={() => setActiveId(it.nodeId)}>
              <i className={it.type}>{ICON[it.type]}</i>
              <span>
                <strong>{it.nodeName}</strong>
                <small>{stats.rackDone ? it.rack : '机柜未登记'}</small>
              </span>
              <em>{stats.done ? '✓' : stats.diff ? stats.diff + ' 差异' : stats.pending ? stats.pending + ' 待登' : '核'}</em>
            </button>
          ))}
        </aside>

        {/* 中：单台设备登记表单 */}
        <section className="r-col r-form">
          <div className="form-head">
            <i className={item.type}>{ICON[item.type]}</i>
            <div>
              <strong>{item.nodeName}</strong>
              <small>图上 {item.links.length} 条连接{active.stats.diff > 0 && <> · {active.stats.diff} 条差异</>}</small>
            </div>
          </div>

          <div className="field-grid">
            <label className="fld">
              <span>实际机柜 <i>*</i></span>
              <input disabled={readOnly} placeholder="如 A-03" value={item.rack} onChange={(e) => mutateItem((it) => ({ ...it, rack: e.target.value }))} />
            </label>
            <label className="fld">
              <span>机柜位置(U位)</span>
              <input disabled={readOnly} placeholder="如 U22" value={item.rackPos} onChange={(e) => mutateItem((it) => ({ ...it, rackPos: e.target.value }))} />
            </label>
          </div>

          <div className="link-table-head">图上连接 —— 逐根登记现场面板接口与标签编号</div>
          {item.links.map((l) => {
            const j = judgeLink(l);
            const showDiff = j.status === 'diff';
            const needReason = showDiff && (reasonMissing({ ...j, reason: l.reason }) || !l.resolution);
            return (
              <div key={l.key} className={'link-card ' + j.status}>
                <div className="link-top">
                  <span className="peer">⌁ {l.peerName}</span>
                  <span className={'verdict v-' + j.status}>{STATUS_TEXT[j.status]}</span>
                </div>
                <div className="diagram-line">
                  图上：{l.diagramPort ? <b>{l.diagramPort}</b> : <em>未标接口</em>}
                  {l.diagramLabel && <> · 标签 <b>{l.diagramLabel}</b></>}
                </div>
                <div className="actual-grid">
                  <label className="fld">
                    <span>现场面板接口</span>
                    <input disabled={readOnly || l.notFound} placeholder="如 GE0/0/24" value={l.actualPort} onChange={(e) => mutateLink(l.key, { actualPort: e.target.value })} />
                  </label>
                  <label className="fld">
                    <span>标签编号</span>
                    <input disabled={readOnly || l.notFound} placeholder="如 L-A03-12" value={l.actualLabel} onChange={(e) => mutateLink(l.key, { actualLabel: e.target.value })} />
                  </label>
                </div>
                <label className={'checkline' + (readOnly ? ' disabled' : '')}>
                  <input type="checkbox" disabled={readOnly} checked={l.notFound} onChange={(e) => mutateLink(l.key, { notFound: e.target.checked, resolution: e.target.checked ? l.resolution : '', reason: e.target.checked ? l.reason : '' })} />
                  现场找不到这根线（图上有、现场没有）
                </label>
                <label className={'checkline' + (readOnly ? ' disabled' : '')}>
                  <input type="checkbox" disabled={readOnly} checked={!!l.forceDiff} onChange={(e) => mutateLink(l.key, { forceDiff: e.target.checked })} />
                  虽然字段对得上，但现场确认不一致
                </label>
                {showDiff && (
                  <div className={'diff-box' + (needReason && !readOnly ? ' need' : '')}>
                    <div className="diff-row">
                      <label className="fld">
                        <span>差异原因 <i>*</i></span>
                        <select disabled={readOnly} value={l.reasonKind || j.kind} onChange={(e) => mutateLink(l.key, { reasonKind: e.target.value })}>
                          {KIND_ITEMS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                        </select>
                      </label>
                      <label className="fld grow">
                        <span>情况说明</span>
                        <input disabled={readOnly} placeholder="写明现场看到的情况，如“跳线改接到 23 口但图未更新”" value={l.reason} onChange={(e) => mutateLink(l.key, { reason: e.target.value })} />
                      </label>
                    </div>
                    <div className="reso-row">
                      <span>处置 <i>*</i></span>
                      {RESOLUTIONS.map((r) => (
                        <label key={r.value} className={'radio ' + (l.resolution === r.value ? 'on' : '') + (readOnly ? ' disabled' : '')} title={r.desc}>
                          <input type="radio" disabled={readOnly} name={'reso-' + l.key} checked={l.resolution === r.value} onChange={() => mutateLink(l.key, { resolution: r.value })} />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="link-table-head extra-head">
            现场多出的接线（图上没有）
            {!readOnly && <button className="btn mini" onClick={addExtra}>＋ 新增一条</button>}
          </div>
          {item.extras.map((x) => {
            const j = judgeExtra(x);
            const showDiff = j.status === 'diff';
            const needReason = showDiff && (reasonMissing({ ...j, reason: x.reason }) || !x.resolution);
            return (
              <div key={x.id} className={'link-card extra-card ' + (showDiff ? 'diff' : '')}>
                <div className="link-top">
                  <span className="peer">现场新增接线</span>
                  {!readOnly && <button className="btn text danger" onClick={() => removeExtra(x.id)}>移除</button>}
                </div>
                <div className="actual-grid">
                  <label className="fld">
                    <span>对端设备 <i>*</i></span>
                    <select disabled={readOnly} value={x.peerId} onChange={(e) => mutateExtra(x.id, { peerId: e.target.value })}>
                      <option value="">选择对端设备…</option>
                      {topo.nodes.filter((n) => n.id !== item.nodeId).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </label>
                  <label className="fld">
                    <span>现场面板接口</span>
                    <input disabled={readOnly} placeholder="如 GE0/0/48" value={x.actualPort} onChange={(e) => mutateExtra(x.id, { actualPort: e.target.value })} />
                  </label>
                  <label className="fld">
                    <span>标签编号</span>
                    <input disabled={readOnly} placeholder="如 L-A03-18" value={x.actualLabel} onChange={(e) => mutateExtra(x.id, { actualLabel: e.target.value })} />
                  </label>
                </div>
                {showDiff && (
                  <div className={'diff-box' + (needReason && !readOnly ? ' need' : '')}>
                    <div className="diff-row">
                      <label className="fld grow">
                        <span>差异原因 / 说明 <i>*</i></span>
                        <input disabled={readOnly} placeholder="写明这根线为什么现场有、图上没有" value={x.reason} onChange={(e) => mutateExtra(x.id, { reason: e.target.value })} />
                      </label>
                    </div>
                    <div className="reso-row">
                      <span>处置 <i>*</i></span>
                      {RESOLUTIONS.filter((r) => r.value !== 'later').map((r) => (
                        <label key={r.value} className={'radio ' + (x.resolution === r.value ? 'on' : '') + (readOnly ? ' disabled' : '')} title={r.desc}>
                          <input type="radio" disabled={readOnly} name={'reso-' + x.id} checked={x.resolution === r.value} onChange={() => mutateExtra(x.id, { resolution: r.value })} />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!item.extras.length && <div className="no-extra">暂无，现场发现图上没有的接线时点上方按钮登记</div>}
        </section>

        {/* 右：差异区 —— 没处理完的差异集中在这里，关单前逐条清零 */}
        <aside className="r-col r-diffs">
          <div className="col-head danger">差异区 <small>{diffRows.length} 条</small></div>
          {!diffRows.length && <div className="diff-empty">当前没有差异，登记时发现不一致会自动进入这里。</div>}
          {diffRows.map((r, i) => {
            const row = findRow(r.item, r);
            const isExtra = r.kind === 'extra';
            const missReason = reasonMissing({ reason: row?.reason });
            const noReso = !row?.resolution;
            const open = row && (!row.resolution || row.resolution === 'later');
            return (
              <button key={i} className={'diff-entry' + (r.item.nodeId === item.nodeId ? ' on' : '') + (open ? ' unresolved' : ' resolved')} onClick={() => setActiveId(r.item.nodeId)}>
                <div className="de-top">
                  <b>{r.nodeName}</b>
                  <em>{DIFF_KIND[r.kind]?.label || '其他不一致'}</em>
                </div>
                <small>{isExtra ? `现场接线 → ${topo.nodes.find((n) => n.id === row.peerId)?.name || '未选对端'}` : `连接 ${row.peerName}`}</small>
                {missReason && <span className="tag warn">缺原因</span>}
                {noReso && <span className="tag warn">缺处置</span>}
                {row?.resolution === 'later' && <span className="tag warn">暂不处理</span>}
                {row?.resolution === 'accept' && <span className="tag ok">按现场改图</span>}
                {row?.resolution === 'fixed' && <span className="tag ok">现场已整改</span>}
                {row?.reason && <p>{row.reason}</p>}
              </button>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
