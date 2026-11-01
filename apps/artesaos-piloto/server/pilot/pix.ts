/** Format checks only; ownership and bank availability require administrator verification. */
export function validPixKey(value:string){
 if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return true;
 if(/^\+[1-9]\d{9,14}$/.test(value))return true;
 if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))return true;
 if(!/^\d{11}$|^\d{14}$/.test(value)||/^(\d)\1+$/.test(value))return false;
 const digits=[...value].map(Number),length=digits.length,base=length-2;
 const check=(n:number)=>{const weights=length===11?Array.from({length:n},(_,i)=>n+1-i):Array.from({length:n},(_,i)=>(n-1-i)%8+2);const remainder=digits.slice(0,n).reduce((sum,d,i)=>sum+d*weights[i],0)%11;return remainder<2?0:11-remainder;};
 return check(base)===digits[base]&&check(base+1)===digits[base+1];
}
