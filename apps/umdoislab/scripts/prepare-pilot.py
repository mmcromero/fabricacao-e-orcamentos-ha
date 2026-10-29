#!/usr/bin/env python3
"""Prepare the agreed lighter-cover pilot; never modifies a database or a site."""
import argparse, csv, hashlib, io, json, re
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit

def split(value):
    return [x.replace(r'\,', ',').strip() for x in re.split(r'(?<!\\),', value or '') if x.strip()]

def prepare(path, site_url, category):
    url=urlsplit(site_url)
    if url.scheme != "https" or not url.netloc or url.username or url.password or url.query or url.fragment or url.path not in ("", "/"):
        raise ValueError("Informe somente a origem HTTPS do site, sem credenciais.")
    site_url=site_url.rstrip("/")
    raw=path.read_bytes()
    rows=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    bases=[r for r in rows if r['Tipo'] in ('simple','variable') and r['Publicado']=='1' and category in split(r['Categorias'])]
    products=[]
    for b in bases:
        refs={'id:'+b['ID']}
        if b['SKU']: refs.add(b['SKU'])
        children=[r for r in rows if r['Tipo']=='variation' and r['Ascendente'] in refs and r['Publicado']=='1']
        groups=defaultdict(list)
        if b['Tipo']=='simple': groups[()]=[b]
        else:
            if not children: raise ValueError('Produto variável publicado sem variações: '+b['ID'])
            for r in children:
                attrs=tuple(((r.get(f'Nome do atributo {i}') or '').casefold(),r.get(f'Valores do atributo {i}') or '') for i in range(1,8) if r.get(f'Nome do atributo {i}') and 'cor' not in r[f'Nome do atributo {i}'].casefold())
                groups[attrs].append(r)
        for attrs, variants in groups.items():
            prices={r['Preço'] for r in variants}
            if len(prices)!=1 or '' in prices: raise ValueError('Preço ausente ou conflitante: '+b['ID'])
            cents=Decimal(next(iter(prices)))*100
            if cents!=cents.to_integral_value() or cents<0: raise ValueError('Preço inválido')
            physical={}
            for key, column, factor in [('weightGrams','Peso (kg)',1000),('lengthCm','Comprimento (cm)',1),('widthCm','Largura (cm)',1),('heightCm','Altura (cm)',1)]:
                values={r[column] or b[column] for r in variants}
                if len(values)!=1: raise ValueError('Medidas conflitantes entre cores: '+b['ID'])
                value=next(iter(values)); physical[key]=float(Decimal(value)*factor) if value else None
                if physical[key] is not None and physical[key]<=0: raise ValueError('Medida inválida')
            colors=[]
            for r in variants:
                for i in range(1,8):
                    if 'cor' in (r.get(f'Nome do atributo {i}') or '').casefold():
                        for color in split(r.get(f'Valores do atributo {i}') or b.get(f'Valores do atributo {i}')):
                            if color not in colors:colors.append(color)
            codes={r['SKU'].strip() for r in variants if r['SKU'].strip()}
            if len(codes)>1: raise ValueError('SKUs distintos no agrupamento de cores: '+b['ID'])
            sku=next(iter(codes), b['SKU'].strip())
            products.append(dict(sku=sku,name=b['Nome']+(' — '+', '.join(v for _,v in attrs) if attrs else ''),origin='own',publicAllowed=True,prices=dict(wholesale=None,factory=None,retail=int(cents)),family=b['Nome'],category=category.rsplit(' > ',1)[-1],imageUrl=next((u for u in split(b['Imagens']) if u.startswith('https://')), ''),description=b['Descrição curta'] or b['Descrição'],colors=colors,sourceFamily=site_url+'#woocommerce:'+b['ID'],sourceKeys=[site_url+'#woocommerce:'+r['ID'] for r in variants],**physical))
    skus=[p['sku'] for p in products if p['sku']]
    if len(skus)!=len(set(skus)): raise ValueError('SKU repetido na carga preparada')
    return dict(formatVersion=1,sourceSha256=hashlib.sha256(raw).hexdigest(),category=category,baseCount=len(bases),products=products)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('csv',type=Path);parser.add_argument('output',type=Path);parser.add_argument('--site-url',required=True);parser.add_argument('--category',default='Headshop > Capas para Isqueiros');args=parser.parse_args()
    data=prepare(args.csv,args.site_url,args.category)
    with args.output.open('x',encoding='utf-8') as f:json.dump(data,f,ensure_ascii=False,indent=2)
    print(f"Prévia: {data['baseCount']} produtos-base; {len(data['products'])} cadastros. Nenhum banco alterado.")
