import {randomBytes} from 'node:crypto';
import {headers,session} from './_lib/security.js';
import {page} from './_lib/admin-view.js';
export default async function adminPage(req,res){
 headers(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 const nonce=randomBytes(18).toString('base64');
 res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`);
 res.setHeader('Content-Type','text/html; charset=utf-8');
 try{return res.status(200).send(page(nonce,Boolean(await session(req))));}
 catch{return res.status(503).send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Área restrita</title><h1>Área administrativa indisponível</h1><p>A configuração de acesso ainda não foi concluída.</p></html>');}
}
