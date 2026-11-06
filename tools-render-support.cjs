const fs=require('fs'),path=require('path'),vm=require('vm');
let ts; try {ts=require('typescript')} catch {ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const root=__dirname; global.location={hash:'#support',search:process.env.ROS_QA?'?qa='+process.env.ROS_QA:''}; global.localStorage={getItem:()=>null}; global.window={addEventListener:()=>{},scrollTo:()=>{}};
let failed=[];
function mod(p){
 const abs=path.join(root,p); const text=fs.readFileSync(abs,'utf8');
 const output=ts.transpileModule(text,{fileName:abs,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});
 if(output.diagnostics?.length)failed.push(...output.diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')));
 // The source uses Vite's import.meta.env.BASE_URL. This CommonJS-only
 // legacy renderer substitutes the same configured base for its static preview.
 return output.outputText.replaceAll('import.meta.env.BASE_URL', JSON.stringify(process.env.GITHUB_PAGES_BASE || '/'));
}
const e=(type,props)=>({type,props:props||{}});
const React={useState:(x)=>[x&&typeof x==='object'&&'status' in x&&process.env.ROS_STATUS?{...x,status:process.env.ROS_STATUS}:x==='Conversation'&&['Details','Activity'].includes(process.env.ROS_TAB)?process.env.ROS_TAB:typeof x==='function'?x():x,()=>{}],useEffect:()=>{},useRef:()=>({current:null}),useMemo:(fn)=>fn(),createElement:(t,p,...c)=>e(t,{...p,children:c}),Fragment:Symbol('fragment')};
const iconNames=['Paperclip','Ticket','CircleCheck','MoreHorizontal','MapPin','ArrowRight','ArrowUpRight','Bell','BookOpen','Building2','CalendarDays','Check','ChevronDown','ChevronRight','CircleHelp','Clock3','CreditCard','Download','FileClock','FileText','Headphones','Store','MessageCircle','ReceiptText','Settings','LayoutDashboard','LockKeyhole','Menu','Plus','Search','Settings2','ShieldCheck','SlidersHorizontal','Sun','Users','Wallet','X','Flag'];

const pathD={
  Store:'M3 10l1-6h16l1 6v11H3V10M3 10c1 2 4 2 5 0 1 2 4 2 5 0 1 2 4 2 5 0 1 2 4 2 5 0M8 21v-7h8v7',MessageCircle:'M21 11a8 8 0 0 1-8 8c-2 0-3 0-4-1l-5 2 1-5a8 8 0 1 1 16-4',ReceiptText:'M5 3h14v18l-3-2-3 2-3-2-3 2-2-2V3M8 8h8M8 12h8M8 16h4',Settings:'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1',
  Ticket:'M2 9V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a3 3 0 0 0 0 6v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a3 3 0 0 0 0-6zM13 5v2m0 4v2m0 4v2',CircleCheck:'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0M8 12l3 3 5-6',
  ArrowRight:'M4 12h16m-6-6 6 6-6 6',ArrowUpRight:'M5 19 19 5M8 5h11v11',ChevronDown:'m6 9 6 6 6-6',ChevronRight:'m9 5 7 7-7 7',
  Search:'M20 20l-5-5',Bell:'M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 21h4',
  Headphones:'M3 13v-2a9 9 0 0 1 18 0v2M3 13v6h4v-7H3M17 12v7h4v-6h-4',
  FileText:'M7 3h8l4 4v14H7zM15 3v5h4M10 12h6M10 16h6',
  CreditCard:'M3 6h18v13H3zM3 10h18M7 15h3',Wallet:'M4 5h16v15H4zM4 9h16M15 14h5',
  Settings2:'M3 5h18M3 12h18M3 19h18',Users:'M6 20v-2a6 6 0 0 1 12 0v2M17 7a3 3 0 0 1 0 6',
  LayoutDashboard:'M3 3h8v8H3zM15 3h6v6h-6zM3 15h6v6H3zM13 13h8v8h-8z',
  CalendarDays:'M3 5h18v16H3zM7 3v4M17 3v4M3 10h18',
  Building2:'M4 21V5h11v16M15 11h5v10M8 9h2M8 13h2M8 17h2M11 21v-4h3',
  ShieldCheck:'m12 2 8 3v6c0 6-4 9-8 11C8 20 4 17 4 11V5zM8 12l3 3 5-6',
  SlidersHorizontal:'M3 6h18M3 12h18M3 18h18',
  CircleHelp:'M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3M12 17h.01',
  Sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  Plus:'M12 5v14M5 12h14',Check:'m4 12 5 5L20 6',X:'M5 5l14 14M19 5 5 19',
  Download:'M12 3v12M7 10l5 5 5-5M5 20h14',FileClock:'M6 3h9l3 3v8M9 12h4M9 16h3',
  BookOpen:'M3 5c4-1 7-1 9 1 2-2 5-2 9-1v16c-4-1-7-1-9 1-2-2-5-2-9-1z',
  LockKeyhole:'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
  Menu:'M4 6h16M4 12h16M4 18h16',Flag:'M5 21V4m0 1h14l-2 4 2 4H5',MapPin:'M12 22s7-6.5 7-13a7 7 0 0 0-14 0c0 6.5 7 13 7 13zM12 7a2 2 0 1 0 0 4a2 2 0 1 0 0-4'
};
const lucide=Object.fromEntries(iconNames.map(name=>[name,({size=20,strokeWidth=2})=>e('svg',{
 viewBox:'0 0 24 24',width:size,height:size,fill:'none',stroke:'currentColor',strokeWidth,strokeLinecap:'round',strokeLinejoin:'round',
 children:[...(name==='Search'?[e('circle',{cx:10,cy:10,r:7})]:[]),...(name==='Sun'?[e('circle',{cx:12,cy:12,r:4})]:[]),
 ...(name==='Users'?[e('circle',{cx:11,cy:8,r:3.1}),e('path',{d:'M5 20v-2a6 6 0 0 1 12 0v2'})]:[]),
 ...(name==='CircleHelp'?[e('circle',{cx:12,cy:12,r:9})]:[]),
 ...(name==='Settings2'?[e('circle',{cx:9,cy:6,r:2}),e('circle',{cx:16,cy:12,r:2}),e('circle',{cx:10,cy:18,r:2})]:[]),
 ...(pathD[name]?[e('path',{d:pathD[name]})]:[e('rect',{x:4,y:4,width:16,height:16,rx:3})])]
})]));

const cache={};function requireLocal(file){if(cache[file])return cache[file].exports;const module={exports:{}};cache[file]=module;
 const code=mod(file);const dirname=path.dirname(file);
 const localRequire=(name)=>{
  if(name==='react'||name==='react/jsx-runtime')return {...React,jsx:e,jsxs:e};
  if(name==='lucide-react')return lucide;
  if(name.startsWith('.'))return requireLocal(path.join(dirname,name)+'.ts'.replace('.ts.ts','.ts').replace('.tsx.ts','.tsx'));throw Error('Unknown dependency '+name)
 };
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{React,Date,Math,console,localStorage:{getItem:()=>null},location:{hash:'#support',search:process.env.ROS_QA?'?qa='+process.env.ROS_QA:''},window:{addEventListener:()=>{}},globalThis}, {filename:file})(localRequire,module,module.exports);
 return module.exports;
}
// intercept filesystem extension lookup
function getMod(file){ if(fs.existsSync(path.join(root,file)))return requireLocal(file); if(fs.existsSync(path.join(root,file.replace(/\.ts$/,'.tsx'))))return requireLocal(file.replace(/\.ts$/,'.tsx'));return requireLocal(file) }
const original=requireLocal;
// wrap resolution by adapting resolver before loading
const src=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
// render just Dashboard instead of App, extracting it from the export's virtual children via App
function escape(str){return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function style(obj){return Object.entries(obj||{}).map(([k,v])=>k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+v).join(';')}
function render(v){if(v==null||typeof v==='boolean')return '';if(Array.isArray(v))return v.map(render).join('');if(typeof v==='string'||typeof v==='number')return escape(v);if(typeof v.type==='function')return render(v.type(v.props||{}));if(typeof v.type==='symbol')return render(v.props.children);const tag=v.type,p=v.props||{};if(['br','hr','img','input','meta','link'].includes(tag)){const attrs=[];for(let [k,val] of Object.entries(p)){if(k==='children'||k==='key'||k.startsWith('on')||val==null)continue;if(k==='className')k='class';if(k==='style')val=style(val);attrs.push(`${k}="${escape(val)}"`)}return `<${tag}${attrs.length?' '+attrs.join(' '):''}>`}const attrs=[];for(let [k,val] of Object.entries(p)){if(k==='children'||k==='key'||k==='ref'||k.startsWith('on')||val==null)continue;if(k==='className')k='class';if(k==='htmlFor')k='for';if(k==='strokeWidth')k='stroke-width';if(k==='strokeLinecap')k='stroke-linecap';if(k==='strokeLinejoin')k='stroke-linejoin';if(k==='viewBox')k='viewBox';if(k==='stopColor')k='stop-color';if(k==='stopOpacity')k='stop-opacity';if(k==='style'){val=style(val)}if(typeof val==='boolean'){if(val)attrs.push(k);continue;}attrs.push(`${k}="${escape(val)}"`)}return `<${tag}${attrs.length?' '+attrs.join(' '):''}>${render(p.children)}</${tag}>`}
// Custom loader robustly resolves App -> ./domain/store -> ../data/demo
function load(file){file=file.replace(/\\/g,'/');if(cache[file])return cache[file].exports;const module={exports:{}};cache[file]=module;const code=mod(file),dirname=path.posix.dirname(file);
 const req=(name)=>{if(name==='react'||name==='react/jsx-runtime')return {...React,jsx:e,jsxs:e};if(name==='lucide-react')return lucide;if(name.startsWith('.')){const p=path.posix.normalize(path.posix.join(dirname,name));for(const f of [p+'.ts',p+'.tsx',p])if(fs.existsSync(path.join(root,f)))return load(f);throw Error(`Could not find ${name} from ${file}`)}throw Error(name)};
 const factory=vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename:file});factory(req,module,module.exports);return module.exports;}
let html='';try{const {App}=load('src/App.tsx');html=render(e(App,{}));}catch(err){console.error(err);process.exit(2)}
if(failed.length){console.error(failed);process.exit(2)}
const tokens=fs.readFileSync(path.join(root,'src/styles/tokens.css'),'utf8'); let css=fs.readFileSync(path.join(root,'src/styles/app.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/typography.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/components.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/responsive.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/motion.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/support.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/sidebar-story.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/support-motion.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/navigation-cleanup.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/light-sidebar-v058.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/styles/layout-integration-v062.css'),'utf8');for(const name of ['resort-illustration.png','resort-shore.png','sidebar-tropical.png','sidebar-tropical-clean.png','sidebar-coastal-approved-v058.png','sidebar-brand-approved-v058.png','sidebar-icon-dashboard-approved-v058.png','sidebar-icon-support-approved-v058.png','sidebar-icon-audit-approved-v058.png','sidebar-icon-systems-approved-v058.png','support-painterly-banner.png','support-coastal-panorama-v0661.png']){const art=fs.readFileSync(path.join(root,'public/assets',name)).toString('base64'); const data='data:image/png;base64,'+art; css=css.split('/assets/'+name).join(data);html=html.split('/assets/'+name).join(data)} const document=`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>resortOS Support Stage 01-02 visual proof</title><style>${tokens}\n${css}</style></head><body><div id="root">${html}</div></body></html>`;
fs.writeFileSync(path.join(root,process.env.ROS_QA?'qa-'+process.env.ROS_QA+'.html':'visual-reference.html'),document);
console.log('Transpiled source and rendered static visual check', document.length, 'bytes');
