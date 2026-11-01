export function adminNavigation(base:string,active:'interests'|'support'|'users'|'invitations'){
 const items=[['interests','Interessados no piloto',''],['support','Chamados de suporte','support'],['users','Usuários cadastrados','users'],['invitations','Convites','invitations']] as const;
 return `<nav class="pilot-admin-nav" aria-label="Administração">${items.map(([key,label,path])=>`<a href="${base}${path}"${key===active?' aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}
