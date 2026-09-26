// 资料层：只负责数据的读写与初始值，不做任何判定
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));

export const seed={nodes:[{id:'gw',name:'核心路由器',type:'router',x:470,y:220,ip:'10.0.0.1'},{id:'sw1',name:'交换机 A',type:'switch',x:250,y:370,ip:'10.0.1.1'},{id:'sw2',name:'交换机 B',type:'switch',x:690,y:370,ip:'10.0.2.1'},{id:'web',name:'Web Server',type:'server',x:100,y:520,ip:'10.0.1.10'},{id:'db',name:'Database',type:'server',x:400,y:550,ip:'10.0.1.20'},{id:'user',name:'办公终端',type:'device',x:820,y:530,ip:'10.0.2.22'}],edges:[['gw','sw1'],['gw','sw2'],['sw1','web'],['sw1','db'],['sw2','user']]};

export const loadTopology=()=>read('topology',seed);
export const saveTopology=data=>write('topology',data);

export const loadSheets=()=>read('verifySheets',[]);
export const saveSheets=sheets=>write('verifySheets',sheets);

export const loadVersions=()=>read('topoVersions',[]);
export const saveVersions=versions=>write('topoVersions',versions);
