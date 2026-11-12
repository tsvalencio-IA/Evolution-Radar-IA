import {workspaceConfig} from "./workspace-config.js";
import {searchWorkerUrl} from "./search-config.js";
import {normalizePermissions,canAccess} from "./team-roles.mjs";
import {signupRequest,requestAccess} from "./team-registration.js";
import {manageMember,rejectRequest} from "./team-admin.js";
import {saveSharedLead,archiveSharedLead,saveSharedSearch,copyLegacyLeads,copyLegacyHistory} from "./team-data.js";
const ROOT="workspaces/"+workspaceConfig.id;
const URL="https://www.gstatic.com/firebasejs/11.10.0/";
const full={view:true,search:true,create:true,edit:true,delete:true};
const list=value=>value&&typeof value==="object"?
  Object.entries(value).map(([id,item])=>({...item,id})):[];
export async function openTeam(config,callbacks={}){
  const [sdk,authAPI,api]=await Promise.all([import(URL+"firebase-app.js"),import(URL+"firebase-auth.js"),import(URL+"firebase-database.js")]);
  const app=sdk.getApps().find(x=>x.options.projectId===config.projectId);
  if(!app)throw Error("Firebase principal ainda não inicializado.");
  const auth=authAPI.getAuth(app),db=api.getDatabase(app);
  const call=(name,data)=>callbacks[name]?.(data);
  let user=null,member=null,request=null,status="signed-out",listeners=[],shared=[];
  const owner=()=>user?.uid===workspaceConfig.ownerUid;
  const allowed=action=>owner()||(status==="approved"&&canAccess(member,action));
  const emit=()=>call("onAccess",{status,member,request,isOwner:owner(),emailVerified:owner()?true:user?.emailVerified===true,
    permissions:owner()?full:normalizePermissions(member?.permissions)});
  const stop=arr=>{arr.forEach(unsub=>unsub());arr.length=0;};
  const sub=(ref,fn,arr=listeners)=>arr.push(api.onValue(ref,s=>fn(s.val()),e=>call("onError",e)));
  function sharedWatch(){
    stop(shared);call("onLeads",[]);call("onHistory",[]);
    if(!allowed("view"))return;
    sub(api.ref(db,ROOT+"/leads"),v=>call("onLeads",list(v)),shared);
    const ref=api.query(api.ref(db,ROOT+"/searchHistory"),api.orderByKey(),api.limitToLast(50));
    sub(ref,v=>call("onHistory",list(v).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))),shared);
  }
  authAPI.onAuthStateChanged(auth,u=>{
    stop(listeners);stop(shared);user=u;member=null;request=null;
    call("onLeads",[]);call("onHistory",[]);call("onRequests",[]);call("onMembers",[]);call("onAudit",[]);
    status=u?"checking":"signed-out";emit();
    if(!u)return;
    if(owner()){
      status="approved";member={status,permissions:full};emit();
      sub(api.ref(db,"registrationRequests"),v=>call("onRequests",list(v).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))));
      sub(api.ref(db,ROOT+"/members"),v=>call("onMembers",list(v)));
      sub(api.query(api.ref(db,ROOT+"/adminAudit"),api.orderByKey(),api.limitToLast(50)),
        v=>call("onAudit",list(v).sort((a,b)=>Number(b.at||0)-Number(a.at||0))));
      sharedWatch();
    }else{
      sub(api.ref(db,"registrationRequests/"+u.uid),v=>{request=v;emit()});
      sub(api.ref(db,ROOT+"/members/"+u.uid),v=>{
        member=v||null;status=v?.status==="approved"?(user?.emailVerified?"approved":"email-unverified"):
          ["suspended","revoked"].includes(v?.status)?v.status:"pending";
        emit();sharedWatch();
      });
    }
  },e=>call("onError",e));
  const ctx=()=>({db,api,user,member});
  return {
    signup:(name,email,password)=>signupRequest(config,name,email,password),
    requestApproval:name=>requestAccess(app,auth,api,name),
    resendVerification:async()=>{if(!auth.currentUser)throw Error("Faça login primeiro.");await authAPI.sendEmailVerification(auth.currentUser);},
    refreshVerification:async()=>{if(!auth.currentUser)throw Error("Faça login primeiro.");await authAPI.reload(auth.currentUser);
      user=auth.currentUser;
      status=owner()?"approved":member?.status==="approved"?(user.emailVerified?"approved":"email-unverified"):
        ["suspended","revoked"].includes(member?.status)?member.status:"pending";
      emit();sharedWatch();return user.emailVerified===true;},
    adminAction:(uid,action,permissions,name)=>manageMember({...ctx(),uid,action,permissions,name}),
    reject:uid=>rejectRequest({...ctx(),uid}),
    deleteUser:async(uid,email)=>{
      if(!owner()||!auth.currentUser)throw Error("Somente o administrador pode excluir contas.");
      if(uid===workspaceConfig.ownerUid)throw Error("A conta principal é protegida.");
      if(!searchWorkerUrl)throw Error("Servidor de contas indisponível.");
      const token=await auth.currentUser.getIdToken();
      const res=await fetch(new URL("/admin/delete-user",searchWorkerUrl),{
        method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify({uid,email,confirmation:"EXCLUIR"}),cache:"no-store"
      });
      const result=await res.json().catch(()=>({}));
      if(result.deleted!==true)throw Error(result.error||result.code||"Exclusão não concluída.");
      return result;
    },
    saveLead:lead=>saveSharedLead({...ctx(),lead}),
    archiveLead:id=>archiveSharedLead({...ctx(),id}),
    saveSearch:record=>saveSharedSearch({...ctx(),record}),
    importLegacy:leads=>copyLegacyLeads({...ctx(),leads}),
    importLegacyHistory:history=>copyLegacyHistory({...ctx(),history}),
    allowed,
    get status(){return status},
    get isOwner(){return owner()},
    get member(){return member}
  };
}
