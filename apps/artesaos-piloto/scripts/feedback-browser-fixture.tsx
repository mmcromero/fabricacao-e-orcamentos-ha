// Disposable browser harness. Not imported by the application or runtime entrypoint.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ActionButton from '../src/ActionButton';
import ValidatedForm from '../src/FormValidation';
async function post(name:string){const r=await fetch('/artesaos-piloto/api/test-feedback/'+name,{method:'POST'});if(!r.ok)throw Error('synthetic-sensitive-error');return r.json();}
function Fixture(){
 const [first,setFirst]=useState(''),[second,setSecond]=useState(''),[form,setForm]=useState('');
 return <main><h1>Fixture de feedback</h1><section>
 <ActionButton onClick={async()=>{await post('first');setFirst('Primeira ação concluída.');}}>Primeira ação</ActionButton><p role="status">{first}</p>
 <ActionButton onClick={async()=>{await post('second');setSecond('Segunda ação concluída.');}}>Segunda ação</ActionButton><p role="status">{second}</p>
 </section><section><ValidatedForm onSubmit={async()=>{await post('form');setForm('Formulário confirmado.');}}><label>Informação<input required name="information"/></label><ActionButton>Enviar formulário</ActionButton></ValidatedForm><p role="status">{form}</p></section></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
