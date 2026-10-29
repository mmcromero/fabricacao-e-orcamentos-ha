export const CLIENT_CATEGORY='Produtos de cliente';
export function normalizedProduct<T extends {origin:string;category?:string}>(product:T){return {...product,...(product.origin==='client'?{publicAllowed:false}:{}),category:product.origin==='client'?CLIENT_CATEGORY:(product.category??'').trim()};}
