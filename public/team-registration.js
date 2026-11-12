import {workspaceConfig} from "./workspace-config.js";
import {validAccountName} from "./team-roles.mjs";
const SDK="https://www.gstatic.com/firebasejs/11.10.0/";
export async function signupRequest(config,name,email,password){
  const [app,auth,db]=await Promise.all([import(SDK+"firebase-app.js"),import(SDK+"firebase-auth.js"),import(SDK+"firebase-database.js")]);
  const person=validAccountName(name),mail=String(email||"").trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail))throw Error("E-mail inválido.");
  if(String(password||"").length<8)throw Error("Senha precisa ter ao menos 8 caracteres.");
  const secondary=app.initializeApp(config,"signup-"+Date.now());
  const secondaryAuth=auth.getAuth(secondary);
  let created=false;
  try{
    const user=(await auth.createUserWithEmailAndPassword(secondaryAuth,mail,String(password))).user;
    created=true;
    await db.set(db.ref(db.getDatabase(secondary),"registrationRequests/"+user.uid),{
      name:person,email:mail,status:"pending",sponsorUid:workspaceConfig.ownerUid,
      createdAt:db.serverTimestamp()
    });
    return {created:true,pending:true};
  }catch(e){
    if(created)throw Error("Conta criada, mas a solicitação falhou. Entre nela e tente Solicitar aprovação. "+(e?.code||e?.message||""));
    throw e;
  }finally{
    try{await auth.signOut(secondaryAuth)}catch{}
    try{await app.deleteApp(secondary)}catch{}
  }
}
export async function requestAccess(app,auth,db,name){
  const user=auth.currentUser;
  if(!user||user.uid===workspaceConfig.ownerUid)throw Error("Entre na conta do solicitante.");
  await db.set(db.ref(db.getDatabase(app),"registrationRequests/"+user.uid),{
    name:validAccountName(name),email:user.email,status:"pending",
    sponsorUid:workspaceConfig.ownerUid,createdAt:db.serverTimestamp()
  });
}
