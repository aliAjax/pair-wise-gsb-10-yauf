import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadTopology, saveTopology, loadChecklists, saveChecklists, loadVersions, saveVersions } from './data/storage.js';
import { ensureBaseline, createVersion } from './logic/version.js';
import { buildNextVersion } from './logic/verify.js';
import EditorPage from './ui/EditorPage.jsx';
import ChecklistPage from './ui/ChecklistPage.jsx';
import RunnerPage from './ui/RunnerPage.jsx';
import VersionsPage from './ui/VersionsPage.jsx';

const NAV = [
  { key: 'edit', label: '拓扑编辑' },
  { key: 'check', label: '现场核对' },
  { key: 'versions', label: '版本记录' },
];

function App() {
  const [data, setData] = useState(loadTopology);
  const [checklists, setChecklists] = useState(loadChecklists);
  const [versions, setVersions] = useState(loadVersions);
  const [view, setView] = useState('edit');
  const [openListId, setOpenListId] = useState(null);
  const [notice, setNotice] = useState('');
  const toastTimer = useRef();

  // 资料层持久化：任何编辑自动保存，重开页面接着核
  useEffect(() => saveTopology(data), [data]);
  useEffect(() => saveChecklists(checklists), [checklists]);
  useEffect(() => saveVersions(versions), [versions]);

  const showToast = (msg) => {
    setNotice(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotice(''), 2600);
  };

  const enterView = (key) => {
    if (key === 'check') {
      // 首次进入：先把当前图存档为基线，保证“旧记录仍能查”
      if (!versions.length) setVersions(ensureBaseline(versions, data));
      setOpenListId(null);
    }
    setView(key);
  };

  const openCount = checklists.filter((l) => l.status === 'open').length;
  const activeList = checklists.find((l) => l.id === openListId);

  const createList = (list) => {
    setChecklists((ls) => [list, ...ls]);
    setOpenListId(list.id);
    showToast('已生成待核项，进度会自动保存');
  };
  const updateList = (next) => setChecklists((ls) => ls.map((l) => (l.id === next.id ? next : l)));
  const deleteList = (id) => {
    if (confirm('删除这张进行中的核对单？已登记内容会一起删除。')) {
      setChecklists((ls) => ls.filter((l) => l.id !== id));
      showToast('核对单已删除');
    }
  };

  // 关单：审计在 RunnerPage 里先过一道；这里确认接法 -> 生成新版本 -> 替换当前图
  const closeList = () => {
    if (!activeList) return;
    const { topo, changes } = buildNextVersion(data, activeList);
    const v = createVersion(versions, { topo, list: activeList, changes });
    const closed = { ...activeList, status: 'closed', closedAt: Date.now(), newVersion: v.name };
    setChecklists((ls) => ls.map((l) => (l.id === closed.id ? closed : l)));
    setVersions((vs) => [v, ...vs]);
    setData(topo);
    setView('versions');
    setOpenListId(null);
    showToast(`已关单，确认接法写入 ${v.name}（${changes.count} 处变化）`);
  };

  const validate = () => {
    const linked = new Set(data.edges.flatMap((e) => (Array.isArray(e) ? e : [e.from, e.to])));
    const isolated = data.nodes.filter((n) => !linked.has(n.id));
    showToast(isolated.length ? `发现 ${isolated.length} 个孤立节点` : '拓扑检查通过：没有孤立节点');
  };
  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'network-topology.json';
    a.click();
    showToast('JSON 已导出');
  };

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="brand-mark">⌁</span>
          <div><strong>NETSCAPE</strong><small>TOPOLOGY STUDIO</small></div>
        </div>
        <nav className="main-nav">
          {NAV.map((n) => (
            <button key={n.key} className={view === n.key || (n.key === 'check' && activeList) ? 'on' : ''} onClick={() => enterView(n.key)}>
              {n.label}
              {n.key === 'check' && openCount > 0 && <i className="nav-badge">{openCount}</i>}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button onClick={validate}>✓ 检查</button>
          <button onClick={exportJson}>↓ 导出</button>
          <button className="save" onClick={() => showToast('拓扑图已保存')}>保存更改</button>
        </div>
      </header>

      {view === 'edit' && <EditorPage data={data} onChange={setData} notice={notice} onValidate={validate} />}
      {view === 'check' && !activeList && (
        <ChecklistPage
          topo={data}
          checklists={checklists}
          versions={versions}
          onCreate={createList}
          onOpen={(id) => setOpenListId(id)}
          onDelete={deleteList}
        />
      )}
      {view === 'check' && activeList && (
        <RunnerPage
          list={activeList}
          topo={data}
          onUpdate={updateList}
          onClose={closeList}
          onGoVersions={() => { setOpenListId(null); setView('versions'); }}
        />
      )}
      {view === 'versions' && <VersionsPage versions={versions} />}

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
