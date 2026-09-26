// 页面层：现场核对单弹窗（待核项 / 差异区 / 历史记录）
import React,{useState}from'react';
import{canClose,diffsOf,unresolvedDiffs}from'../logic/verify';

const fmt=ts=>new Date(ts).toLocaleString('zh-CN',{hour12:false});
const nodeName=(topology,id)=>topology.nodes.find(n=>n.id===id)?.name||id;

export default function VerifySheet({topology,openSheet,closedSheets,versions,onStart,onPatchItem,onPatchCheck,onCloseSheet,onRestore,onExit}){
  const[tab,setTab]=useState('items');
  const[pick,setPick]=useState([]);
  const diffs=diffsOf(openSheet);
  const pending=unresolvedDiffs(openSheet).length;
  const closable=canClose(openSheet);

  const toggle=id=>setPick(pick.includes(id)?pick.filter(x=>x!==id):[...pick,id]);

  return <div className="sheet-overlay" onClick={onExit}>
    <div className="sheet-modal" onClick={e=>e.stopPropagation()}>
      <div className="sheet-head">
        <strong>现场核对单</strong>
        {openSheet&&<small>开单时间 {fmt(openSheet.createdAt)} · {openSheet.items.length} 台待核</small>}
        <button className="sheet-exit" onClick={onExit}>✕</button>
      </div>
      <div className="sheet-tabs">
        <button className={tab==='items'?'on':''} onClick={()=>setTab('items')}>待核项</button>
        <button className={tab==='diffs'?'on':''} onClick={()=>setTab('diffs')}>差异区{pending>0&&<em>{pending}</em>}</button>
        <button className={tab==='history'?'on':''} onClick={()=>setTab('history')}>历史记录</button>
      </div>

      {tab==='items'&&<div className="sheet-body">
        {!openSheet?<>
          <p className="sheet-hint">从图上选择要核对的设备，生成待核项：</p>
          <div className="pick-list">
            {topology.nodes.map(n=><label key={n.id} className={pick.includes(n.id)?'on':''}>
              <input type="checkbox" checked={pick.includes(n.id)} onChange={()=>toggle(n.id)}/>
              <strong>{n.name}</strong><small>{n.ip}</small>
            </label>)}
          </div>
          <button className="sheet-primary" disabled={!pick.length} onClick={()=>{onStart(pick);setPick([])}}>生成待核项（{pick.length}）</button>
        </>:<>
          {openSheet.items.map(it=><div className="sheet-item" key={it.nodeId}>
              <div className="sheet-item-head"><strong>{nodeName(topology,it.nodeId)}</strong><small>{it.nodeId}</small></div>
              <div className="sheet-fields">
                <label>实际机柜<input value={it.cabinet} placeholder="如 A-03" onChange={e=>onPatchItem(it.nodeId,{cabinet:e.target.value})}/></label>
                <label>面板接口<input value={it.port} placeholder="如 GE0/0/1" onChange={e=>onPatchItem(it.nodeId,{port:e.target.value})}/></label>
                <label>标签编号<input value={it.label} placeholder="如 LBL-1024" onChange={e=>onPatchItem(it.nodeId,{label:e.target.value})}/></label>
              </div>
              {it.checks.length?it.checks.map(c=><div className={'check-row '+c.status} key={c.key}>
                <span className="check-line">图上接法：↔ {nodeName(topology,c.peer)}</span>
                <span className="check-btns">
                  <button className={c.status==='match'?'on':''} onClick={()=>onPatchCheck(it.nodeId,c.key,{status:'match',resolution:null})}>一致</button>
                  <button className={c.status==='mismatch'?'on':''} onClick={()=>onPatchCheck(it.nodeId,c.key,{status:'mismatch'})}>不一致</button>
                </span>
                {c.status==='mismatch'&&<span className="check-actual">
                  <select value={c.actualPeer} onChange={e=>onPatchCheck(it.nodeId,c.key,{actualPeer:e.target.value})}>
                    <option value="">现场实际对端…</option>
                    {topology.nodes.filter(n=>n.id!==it.nodeId&&n.id!==c.peer).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}
                    <option value="none">现场无此连接</option>
                  </select>
                  <input value={c.reason} placeholder="不一致原因（必填）" onChange={e=>onPatchCheck(it.nodeId,c.key,{reason:e.target.value})}/>
                </span>}
              </div>):<p className="sheet-hint">图上无连接，仅需登记机柜与标签。</p>}
            </div>)}
          <div className="sheet-foot">
            {!closable&&<small>关单前需填齐机柜/接口/标签、核完每条连接，并处理完全部差异（{pending} 条未处理）</small>}
            <button className="sheet-primary" disabled={!closable} onClick={onCloseSheet}>确认并关单（写入新版本）</button>
          </div>
        </>}
      </div>}

      {tab==='diffs'&&<div className="sheet-body">
        {!diffs.length?<p className="sheet-hint">暂无差异。登记为「不一致」的连接会留在这里，处理完才能关单。</p>:
        diffs.map(d=><div className={'diff-row '+(d.resolution?'resolved':'')} key={d.nodeId+d.key}>
          <div className="diff-info">
            <strong>{nodeName(topology,d.nodeId)}</strong>
            <span>图上：↔ {nodeName(topology,d.peer)}</span>
            <span>现场：{d.actualPeer==='none'?'无此连接':d.actualPeer?'↔ '+nodeName(topology,d.actualPeer):'未登记'}</span>
            <span className="diff-reason">原因：{d.reason||'未填写'}</span>
          </div>
          <div className="diff-actions">
            <button className={d.resolution==='adopt'?'on':''} onClick={()=>onPatchCheck(d.nodeId,d.key,{resolution:'adopt'})}>按现场改图</button>
            <button className={d.resolution==='keep'?'on':''} onClick={()=>onPatchCheck(d.nodeId,d.key,{resolution:'keep'})}>维持图上接法</button>
          </div>
        </div>)}
      </div>}

      {tab==='history'&&<div className="sheet-body">
        <div className="hist-title">拓扑版本（{versions.length}）</div>
        {!versions.length&&<p className="sheet-hint">还没有版本记录，关单后确认的接法会写进新版本。</p>}
        {[...versions].reverse().map(v=><div className="hist-row" key={v.id}>
          <div><strong>{v.label}</strong><small>{v.note}</small></div>
          <span className="hist-meta">{v.data.nodes.length} 节点 · {v.data.edges.length} 连接</span>
          <button onClick={()=>onRestore(v)}>恢复此版本</button>
        </div>)}
        <div className="hist-title">已关核对单（{closedSheets.length}）</div>
        {!closedSheets.length&&<p className="sheet-hint">暂无已关核对单。</p>}
        {[...closedSheets].reverse().map(s=><div className="hist-row" key={s.id}>
          <div><strong>{s.id}</strong><small>开单 {fmt(s.createdAt)} · 关单 {fmt(s.closedAt)}</small></div>
          <span className="hist-meta">{s.items.length} 台设备 · {diffsOf(s).length} 条差异</span>
        </div>)}
      </div>}
    </div>
  </div>;
}
