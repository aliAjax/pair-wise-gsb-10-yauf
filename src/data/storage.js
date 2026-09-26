// 资料层：所有 localStorage 读写集中在这里，页面/判定层不直接碰持久化
import { seed } from './seed.js';

const K_TOPO = 'topology';
const K_LISTS = 'field-checklists';
const K_VERSIONS = 'topology-versions';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储不可用时静默降级到内存态，页面仍可用
  }
}

export function loadTopology() {
  return read(K_TOPO, seed);
}

export function saveTopology(topo) {
  write(K_TOPO, topo);
}

export function loadChecklists() {
  return read(K_LISTS, []);
}

export function saveChecklists(lists) {
  write(K_LISTS, lists);
}

export function loadVersions() {
  return read(K_VERSIONS, []);
}

export function saveVersions(versions) {
  write(K_VERSIONS, versions);
}
