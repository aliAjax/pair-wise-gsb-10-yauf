// 判定层：核对单的生成、差异判定、关单判定与版本写入，全部为纯函数
export const edgeKey=(a,b)=>[a,b].sort().join('|');

// 从图上选中的设备生成待核项：每台设备带出图上已有的连接作为应核连接
export function createSheet(topology,nodeIds,now=Date.now()){
  return{
    id:'sheet'+now,
    createdAt:now,
    status:'open',
    items:nodeIds.map(nodeId=>({
      nodeId,
      cabinet:'',   // 实际机柜
      port:'',      // 面板接口
      label:'',     // 标签编号
      checks:topology.edges.filter(e=>e.includes(nodeId)).map(([a,b])=>({
        key:edgeKey(a,b),
        peer:a===nodeId?b:a,   // 图上对端
        status:'pending',      // pending | match | mismatch
        actualPeer:'',         // 现场实际对端，'none' 表示现场无此连接
        reason:'',             // 不一致原因
        resolution:null,       // adopt=按现场改图 | keep=维持图上
      })),
    })),
  };
}

// 差异区：所有登记为不一致的连接
export const diffsOf=sheet=>!sheet?[]:sheet.items.flatMap(it=>
  it.checks.filter(c=>c.status==='mismatch').map(c=>({...c,nodeId:it.nodeId})));

export const unresolvedDiffs=sheet=>diffsOf(sheet).filter(d=>!d.resolution);

// 关单判定：基本信息填齐、每条连接都核过、每条差异都写明原因并作了处理
export function canClose(sheet){
  if(!sheet||sheet.status!=='open')return false;
  return sheet.items.every(it=>
    it.cabinet.trim()&&it.port.trim()&&it.label.trim()&&
    it.checks.every(c=>
      c.status!=='pending'&&
      (c.status!=='mismatch'||(c.actualPeer&&c.reason.trim()&&c.resolution))
    )
  );
}

// 关单：把确认后的接法写进拓扑，返回新拓扑与版本记录（旧版本由调用方保留）
export function closeSheet(topology,sheet,now=Date.now()){
  const edges=topology.edges.map(e=>[...e]);
  const changes=[];
  for(const it of sheet.items){
    for(const c of it.checks){
      if(c.status!=='mismatch'||c.resolution!=='adopt')continue;
      const idx=edges.findIndex(e=>edgeKey(e[0],e[1])===c.key);
      if(c.actualPeer==='none'){
        if(idx>=0){edges.splice(idx,1);changes.push(`断开 ${it.nodeId} ↔ ${c.peer}`);}
      }else{
        const dup=edges.some((e,i)=>i!==idx&&edgeKey(e[0],e[1])===edgeKey(it.nodeId,c.actualPeer));
        if(!dup){
          if(idx>=0){edges[idx]=[it.nodeId,c.actualPeer];changes.push(`${it.nodeId} 改接 ${c.peer} → ${c.actualPeer}`);}
          else{edges.push([it.nodeId,c.actualPeer]);changes.push(`新增 ${it.nodeId} ↔ ${c.actualPeer}`);}
        }
      }
    }
  }
  const newTopology={...topology,edges};
  const version={
    id:'v'+now,
    at:now,
    sheetId:sheet.id,
    label:`核对单确认版 ${new Date(now).toLocaleString('zh-CN',{hour12:false})}`,
    note:changes.length?changes.join('；'):'现场与图上一致，无改动',
    data:newTopology,
  };
  return{topology:newTopology,version,sheet:{...sheet,status:'closed',closedAt:now}};
}
