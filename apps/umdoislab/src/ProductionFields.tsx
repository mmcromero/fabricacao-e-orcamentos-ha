import DurationFields from './DurationFields';
import type {ProductionStep} from '../server/manufacturing-model';
export default function ProductionFields({value,onChange,prefix}:{value:ProductionStep;onChange:(value:ProductionStep)=>void;prefix:string}){
 return <>{([['machineSeconds','Tempo de máquina'],['humanSeconds','Tempo de trabalho humano']] as const).map(([key,label])=><DurationFields key={key} label={label} prefix={`${prefix}-${key}`} value={value[key]} onChange={seconds=>onChange({...value,[key]:seconds})}/>)}{([['materialGrams','Material utilizado (g)'],['extras','Materiais extras (R$)'],['packaging','Embalagem de fabricação (R$)'],['label','Etiqueta (R$)']] as const).map(([key,label])=><label key={key}>{label}<input type="number" min="0" max={key==='materialGrams'?1000000:100000000} step="any" value={value[key]??''} onChange={e=>onChange({...value,[key]:e.target.value===''?null:Number(e.target.value)})}/></label>)}</>;
}
