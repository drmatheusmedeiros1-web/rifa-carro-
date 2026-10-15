import {randomBytes,scryptSync} from 'node:crypto';
import {emitKeypressEvents} from 'node:readline';
if(!process.stdin.isTTY){console.error('Execute em um terminal interativo. A senha não deve ser passada como argumento.');process.exit(1);}
function hidden(prompt){return new Promise(resolve=>{process.stdout.write(prompt);let value='';emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();const handler=(str,key)=>{if(key?.ctrl&&key.name==='c'){process.stdin.setRawMode(false);process.exit(130);}if(key?.name==='return'){process.stdin.removeListener('keypress',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value);}else if(key?.name==='backspace'){value=value.slice(0,-1);}else if(str&&!key?.ctrl&&!key?.meta&&/^[^\x00-\x1f\x7f]+$/.test(str)){value+=str;}};process.stdin.on('keypress',handler);});}
const password=await hidden('Escolha uma senha exclusiva (mínimo 12 caracteres): ');
if(password.length<12||password.length>256){console.error('Use entre 12 e 256 caracteres.');process.exit(1);}
const confirmation=await hidden('Repita a senha: ');
if(password!==confirmation){console.error('As senhas não coincidem.');process.exit(1);}
const salt=randomBytes(16).toString('hex');
const hash=scryptSync(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
console.log('Salve este valor como ADMIN_PASSWORD_HASH (Secret) na Vercel:');
console.log(`scrypt$${salt}$${hash}`);
