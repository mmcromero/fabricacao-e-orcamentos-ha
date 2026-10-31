export const communityCss=`*{box-sizing:border-box}.pilot-admin{max-width:1080px;margin:32px auto;padding:24px}.pilot-table{overflow:auto}table{border-collapse:collapse;width:100%}th,td{padding:12px;text-align:left;border-bottom:1px solid #b8c7be;overflow-wrap:anywhere}.pilot-auth section{margin-top:32px;border-top:1px solid #b8c7be;padding-top:16px}.pilot-auth .pilot-consent{display:flex;align-items:flex-start;gap:10px;font-size:14px}.pilot-auth .pilot-consent input{width:20px;height:20px;flex-shrink:0;margin:0}#interest-privacy{font-size:14px;line-height:1.5}#pilot-account{min-height:96px}.pilot-session-active{padding-top:112px}.pilot-account-title img{max-width:100%;height:72px;width:auto;object-fit:contain;border-radius:6px;background:#f7f6f1}#root .app-version{display:none}.pilot-auth [data-pilot-brand]{text-align:center}.pilot-auth [data-pilot-brand] img{height:120px;width:auto;max-width:100%;object-fit:contain}.pilot-admin button{padding:10px 14px;font:inherit}#admin-pagination:not([hidden]){display:flex;gap:16px;align-items:center;margin-top:20px}#pilot-account button{max-width:100%;overflow-wrap:anywhere}@media(max-width:480px){.pilot-table table,.pilot-table tbody,.pilot-table tr,.pilot-table td{display:block}.pilot-table thead{display:none}.pilot-table tr{border:1px solid #b8c7be;border-radius:8px;margin:12px 0;padding:8px}.pilot-table td{border:0;padding:8px}.pilot-table td::before{content:attr(data-label);display:block;font-size:12px;font-weight:700;margin-bottom:4px}.pilot-admin{padding:16px 12px}.pilot-admin h1{font-size:26px}#pilot-account{padding:10px 12px}.pilot-account-title{font-size:15px}#pilot-account button{font-size:13px;padding:8px}}#pilot-account.pilot-account-user-layout{grid-template-columns:minmax(0,auto) minmax(0,1fr) auto;column-gap:16px;padding-inline:max(20px,calc((100% - 860px)/2 + 20px))}#pilot-account.pilot-account-user-layout .pilot-account-user{text-align:right}`;
export const identityCss=`
:root{--mata:#1E4D3B;--areia:#CBB493;--linho:#F5F5EF;--broto:#4F8A5B;--terracota:#B5653A;--carvao:#1F2A25}
:root body{background:var(--linho);color:var(--carvao);font:16px/1.5 Arial,Helvetica,sans-serif}
:root h1,:root h2,:root h3{font-family:Georgia,"Times New Roman",serif;color:var(--mata);line-height:1.3}
:root a{color:var(--mata)}
:root button,:root .pilot-auth button{background:var(--mata);color:var(--linho);font-family:Arial,Helvetica,sans-serif}
:root input,:root select,:root textarea{font:inherit;color:var(--carvao);accent-color:var(--mata)}
:root :focus-visible{outline:3px solid var(--terracota);outline-offset:3px}
:root section,:root .wf-card{border-color:var(--areia)}
:root #pilot-account{background:var(--mata);color:var(--linho)}
:root #pilot-account button{background:var(--linho);color:var(--mata);border-color:var(--areia)}
:root .pilot-account-title{display:flex;align-items:center;padding:10px 14px}
:root .pilot-account-title img{display:block;width:232px;height:auto;max-width:100%;border-radius:0;background:transparent}
:root .pilot-account-title img[hidden]{display:none}
:root .pilot-session-active{padding-top:132px}
:root .pilot-auth [data-pilot-brand]{margin:0 auto 24px;padding:20px;max-width:240px}
:root .pilot-auth [data-pilot-brand] img{display:block;width:180px;min-width:120px;height:auto;max-width:100%;margin:auto}
:root .pilot-auth [data-pilot-brand] img[hidden]{display:none}
:root #pilot-build-info{background:var(--linho);color:var(--carvao);border-color:var(--areia)}
:root .wf-shell{font-family:Arial,Helvetica,sans-serif;color:var(--carvao);background:var(--linho)}
:root .wf-shell h1,:root .wf-shell h2,:root .wf-shell h3{font-family:Georgia,"Times New Roman",serif}
:root .wf-banner{background:var(--mata)}
:root .wf-shell .wf-secondary,:root .products-screen .more-prices{color:var(--mata);border-color:var(--mata);background:var(--linho)}
:root .quote-modal-body{background:var(--linho)}
@media(max-width:480px){:root .pilot-account-title{padding:8px}
:root .pilot-account-title img{width:120px;min-width:120px}
:root .pilot-session-active{padding-top:132px}}
:root .pilot-auth .pilot-introduction{padding:20px 0}
:root .pilot-kicker{font-weight:700;color:var(--mata)}
:root .pilot-login-shortcut{display:inline-block;padding:12px 0;font-weight:700;text-underline-offset:4px}
:root .pilot-auth section{background:white;border:1px solid var(--areia);border-radius:12px;padding:24px;margin:24px 0 40px}
:root .pilot-auth .pilot-login-section{border-top:5px solid var(--mata);scroll-margin-top:24px}
:root .pilot-auth section h2{margin-top:0}
:root #pilot-account:has(#pilot-navigation){grid-template-columns:auto minmax(0,1fr) minmax(0,160px) auto;padding:10px max(16px,calc((100% - 1200px)/2));gap:16px}
:root #pilot-account:has(#pilot-navigation) .pilot-account-title{padding:8px 12px}
:root #pilot-account:has(#pilot-navigation) .pilot-account-title img{width:180px}
:root #pilot-navigation{min-width:0;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:var(--areia) var(--mata)}
:root #pilot-navigation nav{display:flex;align-items:center;gap:20px;flex-wrap:nowrap;width:max-content;min-width:100%;padding:12px 2px}
:root #pilot-navigation a{display:block;flex:none;white-space:nowrap;color:var(--linho);margin:0!important;padding:8px 0;text-decoration:none}
:root #pilot-navigation a[aria-current=page]{border-bottom:2px solid var(--areia)}
:root #pilot-account:has(#pilot-navigation) .pilot-account-user{text-align:right}
@media(max-width:700px){
 :root #pilot-account:has(#pilot-navigation){grid-template-columns:auto minmax(0,1fr) auto;gap:8px;padding:8px 12px}
 :root #pilot-account:has(#pilot-navigation) .pilot-account-title{padding:8px}
 :root #pilot-account:has(#pilot-navigation) .pilot-account-title img{width:120px}
 :root #pilot-account:has(#pilot-navigation) .pilot-account-user{display:none}
 :root #pilot-navigation nav{gap:16px}
 :root .pilot-auth section{padding:20px}
}

`;
export function brandScript(prefix:string,version:string,available:boolean){return `(()=>{window.pilotBrand=parent=>{parent.replaceChildren();const text=document.createElement('span');text.textContent='Artesão Digital';parent.append(text);if(!${available})return;const img=document.createElement('img');img.alt='Artesão Digital';img.hidden=true;img.onload=()=>{text.hidden=true;img.hidden=false;};img.onerror=()=>{img.remove();text.hidden=false;};parent.append(img);img.src=parent.matches('.pilot-account-title,[data-pilot-brand=horizontal]')?${JSON.stringify(prefix+'brand/logo-horizontal.png?v='+version)}:${JSON.stringify(prefix+'brand/logo.png?v='+version)};};addEventListener('DOMContentLoaded',async()=>{try{await window.pilotBrowserReady;}catch{return;}document.querySelectorAll('[data-pilot-brand]').forEach(window.pilotBrand);});})();`;}
