/* Misa 10.5: teacher-controlled public snapshot; no automatic publication. */
(async()=>{
 const panel=document.createElement('section');panel.style.cssText='margin:12px 20px;padding:14px;background:#233d48;color:white;border:1px solid #6ca4bd;border-radius:10px';
 panel.innerHTML='<h3>📢 Misa 10.5 – Közzététel a játékba (teszt)</h3><p>A tanári felhőmentés NEM teszi automatikusan nyilvánossá a leckéket. Ezzel a gombbal külön közzéteheted a jelenleg megnyitott projektet.</p><button id="m105publish" type="button">Tananyag közzététele a játékhoz</button><p id="m105publishstatus" role="status"></p>';
 document.querySelector('#misa10-cloud')?.insertAdjacentElement('afterend',panel);
 const status=panel.querySelector('#m105publishstatus');const button=panel.querySelector('#m105publish');
 const cfg={apiKey:'AIzaSyCtqncLwvLGRfPaJyX5v3mTKnFwJbwqP1w',authDomain:'gyakoroljunk-misaval.firebaseapp.com',projectId:'gyakoroljunk-misaval',appId:'1:606749224072:web:1dc42e9b9810a59541833d'};
 const [{getApp,getApps,initializeApp},authLib,fs]=await Promise.all([
 import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')]);
 const app=getApps().find(a=>a.name==='misa10-studio') || initializeApp(cfg,'misa10-studio');
 const auth=authLib.getAuth(app),db=fs.getFirestore(app);
 // Wait for persisted login to be restored before checking the user.
 if(typeof auth.authStateReady==='function')await auth.authStateReady();
 button.onclick=async()=>{button.disabled=true;try{
 if(typeof auth.authStateReady==='function')await auth.authStateReady();
 const user=auth.currentUser;if(!user)throw Error('Előbb jelentkezz be tanárként.');
 const role=await fs.getDoc(fs.doc(db,'tanarok',user.uid));if(!role.exists()||role.data().szerepkor!=='admin')throw Error('Csak az adminisztrátor tehet közzé tananyagot.');
 if(typeof project==='undefined'||!Array.isArray(project.subjects))throw Error('Nincs betöltött Studio-projekt.');
 const state=window.misaTeacherCloudState?.();
 if(!state||state.uid!==user.uid||!state.cloudReady||state.conflict||!state.clean)throw Error('Közzététel előtt töltsd be a legfrissebb közös felhőprojektet, és mentsd el a változtatásaidat a tanári felhőbe.');
 const source=await fs.getDoc(fs.doc(db,'tananyag','aktualis'));
 if(!source.exists()||source.data().revision!==state.revision)throw Error('Újabb közös tananyagverzió érkezett. Töltsd be a friss verziót.');
 const published={grade:project.grade,subjects:project.subjects.map(s=>({name:s.name,lessons:s.lessons.map(l=>({title:l.title,content:l.content}))}))};
 const serialized=JSON.stringify(published),parts=serialized.match(/[\s\S]{1,90000}/g)||[];
 if(!parts.length||parts.length>200)throw Error('A tananyag mérete nem támogatott.');
 if(!confirm('Közzéteszed a jelenlegi tananyagot a játékosoknak? A közzétett leckék bárki számára olvashatók lesznek.'))return;
 const version='pub_'+Date.now()+'_'+user.uid.slice(0,8);status.textContent='Közzététel: '+parts.length+' rész feltöltése…';
 for(let i=0;i<parts.length;i++)await fs.setDoc(fs.doc(db,'publikus_tananyag',version+'_p'+i),{text:parts[i]});
 await fs.runTransaction(db,async tx=>{
   const latest=await tx.get(fs.doc(db,'tananyag','aktualis'));
   if(!latest.exists()||latest.data().revision!==state.revision)throw Error('Közben megváltozott a tananyag. Közzététel megszakítva.');
   tx.set(fs.doc(db,'publikus_tananyag','aktualis'),{version,parts:parts.length,publishedAt:fs.serverTimestamp(),sourceRevision:state.revision,publishedBy:user.uid});
 });
 status.textContent='Sikeres közzététel! A játék mostantól lekérheti ezt a verziót.';
 }catch(e){status.textContent='Közzétételi hiba: '+e.message;}finally{button.disabled=false;}};
})().catch(e=>console.error('Misa 10.5',e));
