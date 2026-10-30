import type {ClientDraft} from './client-model';
export default function ClientDetails({client}:{client:ClientDraft&{id:number}}){
 const field=(label:string,value:string,wide=false)=><div key={label} className={wide?'client-detail-wide':undefined}><dt>{label}</dt><dd>{value||'Não informado'}</dd></div>;
 return <div className="client-details-panel" id={`client-details-${client.id}`} role="region" aria-label={`Dados cadastrais de ${client.name.trim()||client.contact.trim()}`}>
  <div><h4>Contato e documento</h4><dl>{field('Telefone',client.phone)}{field('CPF ou CNPJ',client.taxDocument)}{field('E-mail',client.email,true)}</dl></div>
  <div><h4>Endereço de entrega</h4><dl>{field('CEP',client.postal)}{field('Número',client.number)}{field('Rua / logradouro',client.street,true)}{field('Complemento',client.complement)}{field('Bairro',client.district)}{field('Cidade',client.city)}{field('Estado (UF)',client.state)}</dl></div>
 </div>;
}
