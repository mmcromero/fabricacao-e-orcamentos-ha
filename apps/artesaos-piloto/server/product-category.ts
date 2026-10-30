export const CLIENT_CATEGORY='Produtos de cliente';
export function normalizedProduct<T extends {origin:string;category?:string}>(product:T){return {...product,...(product.origin==='client'?{publicAllowed:false}:{}),category:product.origin==='client'?CLIENT_CATEGORY:(product.category??'').trim()};}

export function categoryAllowed(origin:string,category?:string){
 const root=(category??'').split('>')[0].trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR');
 return origin==='client'||root!==CLIENT_CATEGORY.toLocaleLowerCase('pt-BR');
}
