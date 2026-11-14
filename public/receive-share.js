import {parseSharedListing,SHARE_KEY} from "./share-target.mjs";
const result=parseSharedListing(new URLSearchParams(location.search));
history.replaceState(null,"",location.pathname);
const output=document.querySelector("#shareStatus");
if(result.ok){
  try{sessionStorage.setItem(SHARE_KEY,JSON.stringify(result));output.textContent="Link recebido. Abra o Radar para revisar e registrar.";location.replace("./#pesquisa");}
  catch{output.textContent="Não foi possível manter o link nesta sessão. Copie o link individual e use o campo Facebook no Radar.";}
}else output.textContent=result.reason+" Links curtos, de redirecionamento ou de login precisam ser abertos no Facebook para copiar o link individual.";
