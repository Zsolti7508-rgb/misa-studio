/* Misa 10: opt-in teacher cloud workspace. Never overwrites local work automatically. */
(function(){'use strict';
const config={apiKey:'AIzaSyCtqncLwvLGRfPaJyX5v3mTKnFwJbwqP1w',authDomain:'gyakoroljunk-misaval.firebaseapp.com',projectId:'gyakoroljunk-misaval',storageBucket:'gyakoroljunk-misaval.firebasestorage.app',messagingSenderId:'606749224072',appId:'1:606749224072:web:1dc42e9b9810a59541833d'};
const root=document.createElement('section');root.id='misa10-cloud';root.style.cssText='margin:12px 20px;padding:15px;background:#193747;color:#f5f9ff;border:2px solid #5daac0;border-radius:12px;font:15px system-ui';
root.innerHTML='<h2 style="margin:0 0 8px">☁️ Misa 10.4 – Biztonságos közös tanári felhő (teszt)</h2><p id="m10status">Kapcsolódás…</p><div id="m10login"><input id="m10email" type="email" placeholder="Tanári e-mail" autocomplete="username" style="padding:9px;max-width:260px"><input id="m10pass" type="password" placeholder="Jelszó" autocomplete="current-password" style="padding:9px;max-width:220px"><button id="m10signin">Bejelentkezés</button></div><div id="m10actions" hidden><button id="m10upload">☁️ Tananyag feltöltése</button> <button id="m10download">⬇️ Felhőben tárolt tananyag betöltése</button> <button id="m10history">🕘 Verzióelőzmények</button> <button id="m10signout">Kilépés</button><label style="display:inline-flex;gap:6px;align-items:center;margin-left:10px"><input type="checkbox" id="m103auto"> Automatikus felhőmentés</label><p id="m103sync" style="font-size:13px">Az automatikus mentés kikapcsolva. Előbb töltsd be a felhőprojektet.</p><p style="font-size:13px">A tananyag csak tanári belépés után tölthető le. A helyi mentés változatlanul működik. A játék még nem kapcsolódik a Firebase-hez.</p></div>';
const mount=document.querySelector('header');mount?.insertAdjacentElement('afterend',root);
const logoutButton=document.createElement('button');
logoutButton.id='misa101-logout';
logoutButton.type='button';
logoutButton.textContent='↪ Kijelentkezés';
logoutButton.setAttribute('aria-label','Kijelentkezés a Misa Studióból');
logoutButton.style.cssText='position:fixed;right:18px;top:14px;z-index:2147483000;background:#a83232;color:white;border:1px solid #f2aaaa;border-radius:9px;padding:10px 15px;font:600 14px system-ui;cursor:pointer;box-shadow:0 3px 12px #0007;display:none';
document.body.appendChild(logoutButton);
const gateStatus=document.getElementById('misa101-status');const gateMessage=s=>{gateStatus.textContent=s;};
const gateLogin=document.getElementById('misa101-login');gateLogin.onclick=async()=>{if(!auth||!au){gateMessage('A Firebase még nem érhető el.');return;}try{gateMessage('Bejelentkezés…');await au.signInWithEmailAndPassword(auth,document.getElementById('misa101-email').value.trim(),document.getElementById('misa101-password').value);document.getElementById('misa101-password').value='';}catch(e){gateMessage('Sikertelen bejelentkezés: '+e.code);}};
const $=id=>document.getElementById(id);const msg=s=>$('m10status').textContent=s;
let auth,db,fs,au,me=null,revision=null;
let baseline=null, syncTimer=null, syncBusy=false, syncPending=false, syncConflict=false, remoteNotice=null;
let cloudReady=false;
 let downloadBusy=false, downloadEpoch=0;
const autoBox=$('m103auto'), syncInfo=$('m103sync');
function syncStatus(s){syncInfo.textContent=s;}
function cancelSync(){clearTimeout(syncTimer);syncTimer=null;syncPending=false;autoBox.checked=false;baseline=null;syncConflict=false;remoteNotice=null;syncStatus('Az automatikus felhőmentés kikapcsolva.');}
function queueSync(){
 if(!autoBox.checked||!me||cloudReady!==true||baseline===null||syncConflict)return;
 if(syncBusy){syncPending=true;return;}
 clearTimeout(syncTimer);syncStatus('Helyi változás észlelve; automatikus mentés kb. 4 másodperc múlva…');
 syncTimer=setTimeout(()=>{syncTimer=null;autoSave().catch(e=>syncStatus('Automatikus mentési hiba: '+e.message));},4000);
}
document.addEventListener('misa-studio-changed',queueSync);
autoBox.addEventListener('change',()=>{
 if(!autoBox.checked){clearTimeout(syncTimer);syncStatus('Az automatikus felhőmentés kikapcsolva.');return;}
 if(!me||!cloudReady||baseline===null||syncConflict){autoBox.checked=false;syncStatus('Előbb töltsd be a felhőprojektet; ütközés esetén ments JSON-t és egyeztesd a változásokat.');return;}
 syncStatus('Automatikus felhőmentés bekapcsolva (4 mp várakozás).');
 if(JSON.stringify(project)!==baseline)queueSync();
});
async function autoSave(){
 if(syncBusy){syncPending=true;return;}
 if(!autoBox.checked||!me||!cloudReady||baseline===null||syncConflict)return;
 const snapshot=JSON.stringify(project);
 if(snapshot===baseline)return;
 syncBusy=true;
 try{
  if(!valid(project))throw Error('Érvénytelen projekt');
  const parts=chunks(snapshot);if(parts.length>200)throw Error('A projekt túl nagy');
  const old=await fs.getDoc(manifest()),expected=old.exists()?old.data().revision:0;
  if(expected!==revision){syncConflict=true;autoBox.checked=false;syncStatus('ÜTKÖZÉS: másik tanár mentett! A helyi munkád megmaradt. Ments JSON-t, majd egyeztesd a változásokat; automatikus feltöltés leállítva.');return;}
  const release='r'+Date.now()+'_'+me.uid.slice(0,8);
  syncStatus('Automatikus feltöltés folyamatban ('+parts.length+' rész)…');
  for(let i=0;i<parts.length;i++)await fs.setDoc(fs.doc(db,'tananyag',release+'_p'+i),{text:parts[i],release,index:i,by:me.uid});
  await fs.runTransaction(db,async tx=>{
   const latest=await tx.get(manifest()),now=latest.exists()?latest.data().revision:0;
   if(now!==expected)throw Error('Ütközés: újabb felhőverzió érkezett');
   tx.set(manifest(),{release,parts:parts.length,revision:now+1,updatedAt:fs.serverTimestamp(),updatedBy:me.uid});
   tx.set(fs.doc(db,'tananyag_verziok',String(now+1)),{release,parts:parts.length,revision:now+1,updatedAt:fs.serverTimestamp(),updatedBy:me.uid});
  });
  revision=expected+1;cloudReady=true;baseline=snapshot;
  syncStatus('Automatikus felhőmentés sikeres · verzió: '+revision);
  if(JSON.stringify(project)!==snapshot)syncPending=true;
 }catch(e){
  if(/ütközés/i.test(e.message)){syncConflict=true;autoBox.checked=false;syncStatus('ÜTKÖZÉS: '+e.message+'. A helyi munka megmaradt; JSON-mentés és egyeztetés szükséges.');}
  else syncStatus('Nem sikerült a felhőmentés: '+e.message+' · a helyi mentés megmaradt. A következő módosításnál újrapróbálja.');
 }finally{syncBusy=false;if(syncPending){syncPending=false;if(autoBox.checked&&!syncConflict&&baseline!==null&&JSON.stringify(project)!==baseline)queueSync();}}
}
async function pollCloud(){
 if(!me||revision===null||!cloudReady||syncBusy)return;
 try{
  const m=await fs.getDoc(manifest());if(!m.exists())return;
  const current=m.data().revision;
  if(current===revision)return;
  const hasLocal=baseline===null||JSON.stringify(project)!==baseline;
  if(hasLocal){
   syncConflict=true;autoBox.checked=false;clearTimeout(syncTimer);
   syncStatus('Új felhőverzió ('+current+') érkezett, de helyi módosításaid vannak. JSON-mentés és egyeztetés szükséges; automatikus mentés leállítva.');
  }else if(remoteNotice!==current){
   remoteNotice=current;
   syncStatus('Új felhőverzió érkezett ('+current+'). Kattints a „Felhőben tárolt tananyag betöltése” gombra a frissítéshez.');
  }
 }catch(e){syncStatus('Felhőfrissítés ellenőrzése sikertelen: '+e.message);}
}
setInterval(pollCloud,15000);
// Read-only status for the separate publishing module. No project data exposed.
window.misaTeacherCloudState=()=>({uid:me?.uid||null,revision,cloudReady,conflict:syncConflict,clean:baseline!==null&&JSON.stringify(project)===baseline});
const manifest=()=>fs.doc(db,'tananyag','aktualis');
function chunks(s,n=95000){const a=[];for(let i=0;i<s.length;i+=n)a.push(s.slice(i,i+n));return a;}
function valid(p){return p&&Number.isInteger(p.grade)&&Array.isArray(p.subjects)&&p.subjects.every(s=>typeof s.id==='string'&&Array.isArray(s.lessons));}
async function permitted(user){if(!user)return false;const d=await deadlineRead(fs.getDoc(fs.doc(db,'tanarok',user.uid)),Date.now()+15000);return d.exists()&&['admin','tanar'].includes(d.data().szerepkor);}
async function update(user){downloadEpoch++;logoutButton.style.display='none';document.documentElement.classList.remove('misa-teacher-ok');gateMessage(user?'Tanári jogosultság ellenőrzése…':'Jelentkezz be tanári fiókkal.');me=null;revision=null;cloudReady=false;cancelSync();$('m10actions').hidden=true;$('m10login').hidden=false;if(!user){msg('Jelentkezz be tanári fiókkal.');return;}try{if(!await permitted(user)){gateMessage('Ehhez a fiókhoz nincs tanári jogosultság.');msg('A fiók nincs a tanarok gyűjteményben, vagy nincs megfelelő szerepköre.');return;}document.documentElement.classList.add('misa-teacher-ok');logoutButton.style.display='block';gateMessage('Sikeres belépés.');me=user;$('m10actions').hidden=false;$('m10login').hidden=true;const m=await deadlineRead(fs.getDoc(manifest()),Date.now()+15000);revision=m.exists()?m.data().revision:0;cloudReady=false;msg('Bejelentkezve: '+user.email+' · felhőverzió: '+revision+(m.exists()?' · Automatikus tananyagbetöltés indul…':' · A felhő még üres: a régi, privát Studio-verzióból egyszer fel kell tölteni a tananyagot.'));if(m.exists())await download({automatic:true});}catch(e){gateMessage('Jogosultságellenőrzési hiba: '+e.message);msg('Hozzáférési hiba: '+e.message);}}
 // One overall deadline, rather than 15 seconds for every individual Firestore document.
 function deadlineRead(promise,deadline){
  const remaining=deadline-Date.now();
  if(remaining<=0)return Promise.reject(Error('A felhőbetöltés túllépte a 30 másodperces időkorlátot.'));
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('A Firebase nem válaszolt időben (30 másodperc).')),remaining);})]).finally(()=>clearTimeout(timer));
 }
 async function download(options={}){
  if(!me)return;
  if(downloadBusy){msg('Már folyamatban van egy felhőbetöltés. Várd meg az eredményét.');return;}
  if(syncBusy){msg('Mentés folyamatban. Várd meg a befejezését a betöltés előtt.');return;}
  downloadBusy=true;
  const epoch=++downloadEpoch, userId=me.uid, deadline=Date.now()+30000;
  const check=()=>{if(epoch!==downloadEpoch||!me||me.uid!==userId)throw Error('A betöltés megszakadt: megváltozott a bejelentkezés.');};
  try{
   msg('Felhőverzió ellenőrzése…');
   const m=await deadlineRead(fs.getDoc(manifest()),deadline);check();
   if(!m.exists()){msg('A felhőben még nincs feltöltött tananyag.');return;}
   const data=m.data();
   if(!Number.isInteger(data.parts)||data.parts<1||data.parts>200||!data.release)throw Error('Érvénytelen felhőverzió');
   const hasLocalChanges=(typeof dirty!=='boolean'||dirty);
   if(!options.automatic||hasLocalChanges){
    const question=options.automatic
     ?'A Studio helyi módosításokat vagy bizonytalan mentési állapotot jelez. A felhőtananyag betöltése lecseréli a jelenlegi szerkesztést. Előbb készíts JSON-mentést! Betöltöd a felhőverziót?'
     :'A felhőből betöltött tananyag lecseréli a Studio aktuális szerkesztési állapotát. Előbb készíts JSON-mentést! Folytatod?';
    if(!confirm(question)){if(options.automatic)msg('Automatikus betöltés kihagyva. A helyi projekt változatlan maradt.');return;}
   }
   check();
   const pieces=[];
   for(let i=0;i<data.parts;i++){
    msg('Felhőverzió letöltése… '+(i+1)+'/'+data.parts+' rész');
    const d=await deadlineRead(fs.getDoc(fs.doc(db,'tananyag',data.release+'_p'+i)),deadline);check();
    if(!d.exists()||typeof d.data().text!=='string')throw Error('Hiányzó vagy hibás adatrész: '+i);
    pieces.push(d.data().text);
   }
   const incoming=JSON.parse(pieces.join(''));
   if(!valid(incoming))throw Error('Hibás tananyag');
   msg('Letöltött tananyag ellenőrzése…');
   const latest=await deadlineRead(fs.getDoc(manifest()),deadline);check();
   if(!latest.exists()||latest.data().revision!==data.revision||latest.data().release!==data.release){
    msg('Közben új felhőverzió érkezett. A helyi projekt változatlan maradt; próbáld újra.');return;
   }
   clearTimeout(syncTimer);autoBox.checked=false;syncPending=false;
   project=incoming;sid=project.subjects[0]?.id||null;lid=project.subjects[0]?.lessons[0]?.id||null;qidx=0;dirty=true;
   resetHistory();render();scheduleAutosave();schedulePermanent();
   revision=data.revision;cloudReady=true;baseline=JSON.stringify(project);syncConflict=false;remoteNotice=null;
   syncStatus('Felhőprojekt betöltve. Az automatikus mentést külön bekapcsolhatod.');
   msg('Felhőből betöltve, helyi mentés elindítva. Verzió: '+revision);
  }catch(e){
   if(epoch===downloadEpoch)msg('Letöltési hiba: '+e.message+' A helyi projekt változatlan maradt. A Betöltés gombbal újrapróbálhatod; privát Safariban ellenőrizd a webhelyadatok engedélyezését is.');
  }finally{downloadBusy=false;}
 }
async function upload(){
 if(!me)return;
 if(syncBusy){msg('Másik felhőmentés már folyamatban van. Várd meg a végét.');return;}
 if(!valid(project)){msg('Feltöltési hiba: Érvénytelen helyi projekt');return;}
 const snapshot=JSON.stringify(project),parts=chunks(snapshot);
 if(parts.length>200){msg('Feltöltési hiba: Túl nagy projekt');return;}
 if(!confirm('A jelenlegi Studio-projektet feltöltöd a közös felhőbe? A többi tanár ezt a verziót töltheti le.'))return;
 // Manual and automatic saves share one lock. Never allow either to publish
 // a stale snapshot after the other has already advanced the cloud revision.
 if(syncBusy){msg('Mentés már folyamatban van.');return;}
 syncBusy=true;
 clearTimeout(syncTimer);syncTimer=null;
 try{
  const old=await fs.getDoc(manifest()),expected=old.exists()?old.data().revision:0;
  if(old.exists()&&!cloudReady)throw Error('Előbb töltsd be a központi tananyagot!');
  if(revision!==null&&revision!==expected)throw Error('Ütközés: másik tanár új verziót mentett. Előbb egyeztesd a változásokat.');
  if(syncConflict)throw Error('Ütközés miatt a feltöltés leállítva. Készíts JSON-mentést és egyeztesd a változásokat.');
  const release='r'+Date.now()+'_'+me.uid.slice(0,8);
  msg('Feltöltés: '+parts.length+' adatrész…');
  for(let i=0;i<parts.length;i++)await fs.setDoc(fs.doc(db,'tananyag',release+'_p'+i),{text:parts[i],release,index:i,by:me.uid});
  await fs.runTransaction(db,async tx=>{
   const latest=await tx.get(manifest()),now=latest.exists()?latest.data().revision:0;
   if(now!==expected)throw Error('Ütközés: másik tanár közben mentett. A közös verzió nem változott.');
   tx.set(manifest(),{release,parts:parts.length,revision:now+1,updatedAt:fs.serverTimestamp(),updatedBy:me.uid});
   tx.set(fs.doc(db,'tananyag_verziok',String(now+1)),{release,parts:parts.length,revision:now+1,updatedAt:fs.serverTimestamp(),updatedBy:me.uid});
  });
  revision=expected+1;cloudReady=true;baseline=snapshot;syncConflict=false;
  syncStatus('Kézi feltöltés kész. Az automatikus mentés külön bekapcsolható.');
  msg('Sikeres felhőfeltöltés · verzió: '+revision+'. A játék még nem olvassa közvetlenül a felhőt.');
  if(JSON.stringify(project)!==snapshot)syncPending=true;
 }catch(e){
  if(/ütközés/i.test(e.message)){syncConflict=true;autoBox.checked=false;syncStatus('ÜTKÖZÉS: helyi munka megmaradt; készíts JSON-mentést és egyeztesd a változásokat.');}
  msg('Feltöltési hiba: '+e.message);
 }finally{
  syncBusy=false;
  if(syncPending){syncPending=false;if(autoBox.checked&&!syncConflict&&baseline!==null&&JSON.stringify(project)!==baseline)queueSync();}
 }
}
async function history(){
 if(!me)return;
 if(syncBusy){msg('Mentés folyamatban. Várd meg a befejezését.');return;}
 try{
  msg('Verzióelőzmények lekérése…');
  const result=await fs.getDocs(fs.query(fs.collection(db,'tananyag_verziok'),fs.orderBy('revision','desc'),fs.limit(15)));
  if(result.empty){msg('Még nincsenek rögzített verzióelőzmények. A 10.4 előtti mentések nem szerepelnek ebben a listában.');return;}
  const versions=result.docs.map(d=>d.data());
  const lines=versions.map(v=>v.revision+' – '+(v.updatedAt?.toDate?.().toLocaleString('hu-HU')||'időpont nélkül')+' – '+v.updatedBy).join('\n');
  const choice=prompt('Korábbi felhőverziók (legfeljebb 15):\n'+lines+'\n\nÍrd be a betöltendő verzió számát, vagy Mégse:');
  if(choice===null)return;
  const selected=versions.find(v=>String(v.revision)===choice.trim());
  if(!selected){msg('Nincs ilyen verzió a listában.');return;}
  if(!confirm('A '+selected.revision+'. verzió betöltése lecseréli a helyi szerkesztési állapotot. Előbb készíts JSON-biztonsági mentést! A központi tananyagot ez NEM módosítja. Folytatod?'))return;
  if(!Number.isInteger(selected.parts)||selected.parts<1||selected.parts>200||!selected.release)throw Error('Érvénytelen verzió');
  const pieces=[];
  for(let i=0;i<selected.parts;i++){
   const part=await fs.getDoc(fs.doc(db,'tananyag',selected.release+'_p'+i));
   if(!part.exists())throw Error('Hiányzó verziórész: '+i);
   pieces.push(part.data().text);
  }
  const restored=JSON.parse(pieces.join(''));
  if(!valid(restored))throw Error('Érvénytelen projekt');
  clearTimeout(syncTimer);autoBox.checked=false;
  project=restored;sid=project.subjects[0]?.id||null;lid=project.subjects[0]?.lessons[0]?.id||null;qidx=0;dirty=true;resetHistory();render();scheduleAutosave();schedulePermanent();
  cloudReady=false;baseline=null;syncConflict=true;
  syncStatus('Korábbi verzió csak HELYBEN betöltve. Automatikus mentés leállítva. A központi változat nem módosult.');
  msg('A '+selected.revision+'. verzió helyben megnyitva. Ha ezt szeretnéd központivá tenni, előbb készíts JSON-mentést, majd töltsd be a legfrissebb felhőprojektet és egyeztesd a változásokat.');
 }catch(e){msg('Verzióelőzmény-hiba: '+e.message);}
}
$('m10history').onclick=history;
$('m10signin').onclick=async()=>{try{msg('Bejelentkezés…');await au.signInWithEmailAndPassword(auth,$('m10email').value.trim(),$('m10pass').value);$('m10pass').value='';}catch(e){msg('Bejelentkezési hiba: '+e.message);}};
async function logout(){
   downloadEpoch++;
  logoutButton.disabled=true;
  document.documentElement.classList.remove('misa-teacher-ok');
  logoutButton.style.display='none';
  me=null;revision=null;cloudReady=false;cancelSync();
  $('m10actions').hidden=true;
  $('m10login').hidden=false;
  document.getElementById('misa101-password').value='';
  gateMessage('Kijelentkezés folyamatban…');
  try{await au.signOut(auth);gateMessage('Sikeresen kijelentkeztél. Az új belépéshez kattints a Belépés gombra.');}
  catch(e){gateMessage('Kijelentkezési hiba: '+e.message+' – frissítés után ellenőrizd a bejelentkezést.');}
  finally{logoutButton.disabled=false;}
}
logoutButton.onclick=logout;
$('m10signout').onclick=logout;
$('m10upload').onclick=upload;$('m10download').onclick=()=>download({automatic:false});
(async()=>{try{const base='https://www.gstatic.com/firebasejs/10.14.1/';const [app,authlib,fire]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);au=authlib;fs=fire;const fb=app.initializeApp(config,'misa10-studio');auth=au.getAuth(fb);// Safari privát mód: WebChannel streaming helyett HTTP long polling.
// A Firestore-t az első lekérés előtt kell konfigurálni.
try {
  db=fs.initializeFirestore(fb,{
    experimentalForceLongPolling:true,
    experimentalAutoDetectLongPolling:false,
    useFetchStreams:false
  });
} catch(initError) {
  // Ha másik modul már inicializálta a Firestore-t, ne rejtsük el a hibát.
  throw new Error('Firestore inicializálási ütközés: '+initError.message);
}
au.onAuthStateChanged(auth,update);}catch(e){gateMessage('Firebase betöltési hiba: '+e.message+' (internetkapcsolat szükséges)');msg('Firebase betöltési hiba: '+e.message+' (internetkapcsolat szükséges)');}})();
})();