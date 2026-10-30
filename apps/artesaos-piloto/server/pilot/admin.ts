import {PilotStore} from './store.js';
import {resolve} from 'node:path';
process.umask(0o077);
const [action,email]=process.argv.slice(2);
if(!['invite','revoke'].includes(action)||!email){process.stderr.write('Uso: pilot:admin -- invite|revoke email\n');process.exitCode=1;}else{
 const store=new PilotStore(resolve(process.env.DATA_DIR??'/data'));
 try{if(action==='invite'){const code=store.invite(email);process.stdout.write(`Convite de uso único válido por 24 horas:\n${code}\n`);}else{store.revoke(email);process.stdout.write('Acesso e convites revogados.\n');}}catch{process.stderr.write('Não foi possível executar a ação. Confira os dados.\n');process.exitCode=1;}finally{store.close();}
}
