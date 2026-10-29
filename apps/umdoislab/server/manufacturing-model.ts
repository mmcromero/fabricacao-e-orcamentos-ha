export type ProductionStep={machineSeconds:number|null;humanSeconds:number|null;materialGrams:number|null;extras:number|null;packaging:number|null;label:number|null};
export type Production=ProductionStep&{base?:ProductionStep|null};
export const emptyProduction=():Production=>({machineSeconds:null,humanSeconds:null,materialGrams:null,extras:0,packaging:0,label:0});
export const configFields=[['filamentKgPrice','Preço do quilo de filamento (R$)'],['energyHour','Energia por hora de máquina (R$)'],['wearHour','Desgaste por hora de máquina (R$)'],['humanHour','Valor da hora humana (R$)'],['productiveHours','Horas produtivas por mês'],['wholesaleMarkup','Multiplicador Atacado'],['factoryMarkup','Multiplicador Loja de fábrica'],['retailMarkup','Multiplicador Varejo']] as const;
export const operationFields=[['internetCost','Internet (R$/mês)'],['pluginsCost','Plugins (R$/mês)'],['toolsCost','Ferramentas (R$/mês)'],['energyCost','Energia geral (R$/mês)'],['maintenanceCost','Manutenção (R$/mês)'],['otherCost','Outras despesas (R$/mês)']] as const;
export const productionSchema={type:'object',additionalProperties:false,required:['machineSeconds','humanSeconds','materialGrams','extras','packaging','label'],properties:{machineSeconds:{type:['integer','null'],minimum:0,maximum:3600000000},humanSeconds:{type:['integer','null'],minimum:0,maximum:3600000000},materialGrams:{type:['number','null'],minimum:0,maximum:1000000},extras:{type:['number','null'],minimum:0,maximum:100000000},packaging:{type:['number','null'],minimum:0,maximum:100000000},label:{type:['number','null'],minimum:0,maximum:100000000}}};
export const manufacturingSchema={...productionSchema,properties:{...productionSchema.properties,base:{anyOf:[{type:'null'},productionSchema]}}};
const parse=(raw:string|undefined)=>raw?.trim()&&/^\d+([.,]\d+)?$/.test(raw.trim())?Number(raw.replace(',','.')):null;
export function calculateManufacturing(production:Production,settings:Record<string,string>){
 const pending:string[]=[];const config:Record<string,number>={};
 for(const [key,label] of configFields){const value=parse(settings[key]);if(value===null||!Number.isFinite(value)||value<0||(['productiveHours','wholesaleMarkup','factoryMarkup','retailMarkup'].includes(key)&&value===0))pending.push(label);else config[key]=value;}
 let operatingTotal=0;for(const [key,label] of operationFields){const raw=settings[key];const value=raw?.trim()?parse(raw):0;if(value===null||!Number.isFinite(value))pending.push(label);else operatingTotal+=value;}
 const operatingHour=config.productiveHours?operatingTotal/config.productiveHours:null;
 const cost=(step:ProductionStep,name:string)=>{
  for(const [key,value] of Object.entries(step))if(value===null||typeof value!=='number'||!Number.isFinite(value)||value<0)pending.push(`${name}: ${({machineSeconds:'tempo de máquina',humanSeconds:'tempo de trabalho humano',materialGrams:'material em gramas',extras:'materiais extras',packaging:'embalagem de fabricação',label:'etiqueta'} as Record<string,string>)[key]??'dado inválido'}`);
  if(pending.length)return null;
  const machineHours=step.machineSeconds!/3600,humanHours=step.humanSeconds!/3600;
  return step.materialGrams!*config.filamentKgPrice/1000+machineHours*(config.energyHour+config.wearHour+operatingHour!)+humanHours*config.humanHour+step.extras!+step.packaging!+step.label!;
 };
 const {base,...main}=production;const mainCost=cost(main,'Produção'),baseCost=base?cost(base,'Etapa adicional'):0;
 if(pending.length||mainCost===null||baseCost===null)return {pending,operatingTotal,operatingHour,cost:null,prices:null,rawPrices:null};
 const total=mainCost+baseCost;
 const rawPrices={wholesale:total*config.wholesaleMarkup,factory:total*config.factoryMarkup,retail:total*config.retailMarkup};
 const prices={wholesale:Math.round(rawPrices.wholesale*100),factory:Math.round(rawPrices.factory*100),retail:Math.round(rawPrices.retail*100)};
 if(Object.values(prices).some(value=>!Number.isSafeInteger(value)||value>10000000000))return {pending:['Resultado fora do limite de preços do catálogo'],operatingTotal,operatingHour,cost:null,prices:null,rawPrices:null};
 return {pending,operatingTotal,operatingHour,cost:total,prices,rawPrices};
}
export function durationParts(seconds:number|null){const n=seconds??0;return {hours:Math.floor(n/3600),minutes:Math.floor(n%3600/60),seconds:n%60};}
