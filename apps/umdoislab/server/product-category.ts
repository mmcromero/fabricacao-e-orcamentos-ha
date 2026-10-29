export const CLIENT_CATEGORY='Produtos de cliente';
export function normalizedProduct<T extends {origin:string;category?:string}>(product:T){return {...product,category:product.origin==='client'?CLIENT_CATEGORY:(product.category??'').trim()};}
