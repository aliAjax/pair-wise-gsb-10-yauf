// 判定层 —— 拓扑版本记录
import { uid } from './verify.js';

// 第一次进入现场核对功能时，把当前图存档为基线版本，旧记录以后随时可查
export function ensureBaseline(versions, topo) {
  if (versions.length) return versions;
  return [
    {
      id: uid(),
      no: 1,
      name: '基线版本',
      createdAt: Date.now(),
      source: 'baseline',
      note: '启用现场核对前的当前图面',
      checklistId: null,
      snapshot: JSON.parse(JSON.stringify(topo)),
    },
  ];
}

// 关单确认后生成新版本：保存完整快照，不改原图的入口在这里
export function createVersion(versions, { topo, list, changes, note }) {
  const no = (versions[0]?.no || 0) + 1;
  return {
    id: uid(),
    no,
    name: `V${no}`,
    createdAt: Date.now(),
    source: 'checklist',
    note: note || list.note || `由《${list.title}》确认的接法`,
    checklistId: list.id,
    checklistTitle: list.title,
    changes,
    snapshot: JSON.parse(JSON.stringify(topo)),
  };
}
