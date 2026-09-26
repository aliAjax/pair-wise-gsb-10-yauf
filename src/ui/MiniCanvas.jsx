import React, { useEffect, useRef, useState } from 'react';
import { normEdge } from '../logic/edges.js';

const ICON = { router: '◉', switch: '▦', server: '▣', device: '▱' };
const W = 960;
const H = 640;

function useFit(ref) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

// 只读拓扑快照画布：版本记录里查阅旧图用，带接口/标签小标记
export default function MiniCanvas({ topo }) {
  const wrapRef = useRef(null);
  const scale = useFit(wrapRef);
  const nodes = topo?.nodes || [];
  const edges = (topo?.edges || []).map(normEdge);
  const nodeOf = (id) => nodes.find((n) => n.id === id);

  return (
    <div className="mini-wrap" ref={wrapRef}>
      <div className="mini-stage" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        <svg className="mini-lines" width={W} height={H}>
          {edges.map((e, i) => {
            const a = nodeOf(e.from);
            const b = nodeOf(e.to);
            if (!a || !b) return null;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="mini-line" markerEnd="url(#arrow)" />;
          })}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#879c94" />
            </marker>
          </defs>
        </svg>
        {edges.map((e, i) => {
          const a = nodeOf(e.from);
          const b = nodeOf(e.to);
          if (!a || !b) return null;
          const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          const mk = (text, t, key) =>
            text ? (
              <span
                key={key}
                className="edge-tag"
                style={{ left: a.x + (b.x - a.x) * t, top: a.y + (b.y - a.y) * t - 22, transform: `translateX(-50%) rotate(${ang > 90 || ang < -90 ? ang + 180 : ang}deg)` }}
              >
                {text}
              </span>
            ) : null;
          return (
            <React.Fragment key={i}>
              {mk(e.fromPort || e.label, 0.22, 'a')}
              {mk(e.toPort || e.label, 0.78, 'b')}
            </React.Fragment>
          );
        })}
        {nodes.map((n) => (
          <div key={n.id} className={'mini-node ' + n.type} style={{ left: n.x - 42, top: n.y - 31 }}>
            <i>{ICON[n.type] || '▱'}</i>
            <strong>{n.name}</strong>
            <small>{n.ip}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
