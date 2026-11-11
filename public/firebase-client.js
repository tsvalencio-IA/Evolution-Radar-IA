// Somente código do cliente. A segurança é obrigatória nas regras do Realtime Database.
// Firebase SDK Web: imports sob demanda, sem exigir build ou chave privada.
export async function openFirebase(config,{onAuth,onData,onHistory=()=>{},onError}) {
  const base="https://www.gstatic.com/firebasejs/11.10.0/";
  const [appSDK,authSDK,dbSDK]=await Promise.all([
    import(base+"firebase-app.js"),
    import(base+"firebase-auth.js"),
    import(base+"firebase-database.js")
  ]);
  const app=appSDK.initializeApp(config);
  const auth=authSDK.getAuth(app),db=dbSDK.getDatabase(app);
  let userId=null,unsubscribe=()=>{},unsubscribeHistory=()=>{};
  authSDK.onAuthStateChanged(auth,user=>{
    unsubscribe();unsubscribe=()=>{};
    unsubscribeHistory();unsubscribeHistory=()=>{};
    onHistory([]);
    userId=user?.uid??null;
    onAuth(user);
    if(!userId)return;
    const userRef=dbSDK.ref(db,"users/"+userId+"/data");
    unsubscribe=dbSDK.onValue(userRef,snap=>{
      const payload=snap.val()||{schemaVersion:1,leads:[],filters:{}};
      onData(payload);
    },onError);
    const historyRef=dbSDK.query(dbSDK.ref(db,"users/"+userId+"/searchHistory"),dbSDK.orderByKey(),dbSDK.limitToLast(50));
    unsubscribeHistory=dbSDK.onValue(historyRef,snap=>{
      const value=snap.val()||{};
      onHistory(Object.entries(value).map(([id,record])=>({...record,id})).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))));
    },onError);
  },onError);
  return {
    login:(email,password)=>authSDK.signInWithEmailAndPassword(auth,email,password),
    logout:()=>authSDK.signOut(auth),
    save:async payload=>{
      if(!auth.currentUser || !userId || auth.currentUser.uid!==userId)throw new Error("Usuário não autenticado.");
      await dbSDK.set(dbSDK.ref(db,"users/"+userId+"/data"),payload);
    },
    saveSearch:async record=>{
      if(!auth.currentUser||!userId||auth.currentUser.uid!==userId)throw new Error("Usuário não autenticado.");
      const ref=dbSDK.push(dbSDK.ref(db,"users/"+userId+"/searchHistory"));
      await dbSDK.set(ref,{...record,createdAt:new Date().toISOString()});
      return ref.key;
    }
  };
}
