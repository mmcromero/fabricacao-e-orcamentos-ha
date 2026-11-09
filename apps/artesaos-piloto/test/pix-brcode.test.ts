import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crc16,pixPayload,normalizePixKey,validPixKey,asciiText,pixTxid} from '../src/pix-brcode.ts';

function tlv(text:string){const out:Record<string,string>={};for(let i=0;i<text.length;){const id=text.slice(i,i+2),len=Number(text.slice(i+2,i+4));out[id]=text.slice(i+4,i+4+len);i+=4+len;}return out;}

test('crc16: vetores padrão CCITT-FALSE',()=>{
 assert.equal(crc16('123456789'),'29B1');
 assert.equal(crc16(''),'FFFF');
});

test('payload: campos, valor com 2 casas, CRC consistente',()=>{
 const payload=pixPayload({key:'123e4567-e12b-12d1-a456-426655440000',name:'João da Silva Artesanato',city:'São Paulo'},12345,'AD1X');
 const fields=tlv(payload);
 assert.equal(fields['00'],'01');assert.equal(fields['53'],'986');assert.equal(fields['54'],'123.45');assert.equal(fields['58'],'BR');
 assert.equal(fields['59'],'JOAO DA SILVA ARTESANATO');assert.equal(fields['60'],'SAO PAULO');
 assert.deepEqual(tlv(fields['26']),{'00':'br.gov.bcb.pix','01':'123e4567-e12b-12d1-a456-426655440000'});
 assert.deepEqual(tlv(fields['62']),{'05':'AD1X'});
 assert.equal(payload.slice(-8,-4),'6304');assert.equal(payload.slice(-4),crc16(payload.slice(0,-4)));
});

test('valor: centavos exatos, sem erro de ponto flutuante',()=>{
 for(const [cents,text] of [[1,'0.01'],[10,'0.10'],[1999,'19.99'],[100000,'1000.00'],[29,'0.29']] as const)
  assert.equal(tlv(pixPayload({key:'+5511987654321',name:'A',city:'B'},cents))['54'],text);
});

test('entradas inválidas são rejeitadas',()=>{
 const ok={key:'+5511987654321',name:'Marco',city:'Sao Paulo'};
 assert.throws(()=>pixPayload(ok,0));assert.throws(()=>pixPayload(ok,-5));assert.throws(()=>pixPayload(ok,10.5));
 assert.throws(()=>pixPayload({...ok,key:'abc'},100));assert.throws(()=>pixPayload({...ok,name:''},100));assert.throws(()=>pixPayload({...ok,city:'  '},100));
});

test('chaves: telefone, CPF, CNPJ, e-mail, aleatória',()=>{
 assert.equal(normalizePixKey('(11) 98765-4321'),'+5511987654321');
 assert.equal(normalizePixKey('+55 11 98765-4321'),'+5511987654321');
 assert.equal(normalizePixKey('529.982.247-25'),'52998224725');
 assert.equal(normalizePixKey('11.222.333/0001-81'),'11222333000181');
 assert.equal(normalizePixKey(' Fulano@Email.com '),'fulano@email.com');
 assert.ok(validPixKey('52998224725'));assert.ok(!validPixKey('52998224726'));assert.ok(validPixKey('11222333000181'));assert.ok(validPixKey('+5511987654321'));
});

test('texto e txid',()=>{
 assert.equal(asciiText('Ateliê & Cia — Ação',25),'ATELIE CIA ACAO');
 assert.equal(pixTxid('AD-2026/11 08'),'AD202611' +'08');
 assert.equal(pixTxid('x'.repeat(40)).length,25);
});
