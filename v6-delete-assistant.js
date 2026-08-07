/* Aura Agency V6 - Assistant account removal from panel data.
   Note: browser Firebase SDK cannot securely delete another user's Firebase Auth identity.
   This removes/archives the panel user document and related presence access; Firebase Auth identity
   should be disabled/deleted separately by trusted Admin SDK backend if permanent auth deletion is required. */
(function(){
  function canDeleteAssistant(){return !!window.me && me.role==='admin'}
  window.deleteAssistantV6=async function(uid){
    if(!canDeleteAssistant())return alert('Asistan silme işlemini yalnızca Admin yapabilir.');
    if(uid===me.uid)return alert('Kendi Admin hesabını silemezsin.');
    const u=(window.usersData||[]).find(x=>x.uid===uid);
    if(!u)return alert('Kullanıcı bulunamadı.');
    if(u.role==='admin')return alert('Admin hesabı buradan silinemez.');
    const label=u.name||u.email||uid;
    if(!confirm(`${label} hesabını panelden silmek istiyor musun?\n\nYayıncı ve geçmiş kayıtları güvenlik için silinmeyecek.`))return;
    if(!confirm('Son onay: Bu kullanıcı artık Aura paneline erişemeyecek. Devam edilsin mi?'))return;
    try{
      const ref=db.collection('users').doc(uid);
      const snap=await ref.get();
      if(!snap.exists)return alert('Kullanıcı kaydı zaten yok.');
      await db.collection('trash').doc(`user_${uid}_${Date.now()}`).set({
        type:'deletedUser',uid,userData:snap.data(),deletedAt:firebase.firestore.FieldValue.serverTimestamp(),deletedBy:me.uid
      });
      try{await db.collection('presence').doc(uid).delete()}catch(_){}
      await ref.delete();
      if(window.selectedUser?.uid===uid){window.selectedUser=null;const d=document.getElementById('assistantDetail');if(d)d.innerHTML='<div class="muted">Asistan silindi.</div>'}
      alert('✅ Asistan panelden silindi ve arşive alındı.');
    }catch(e){alert('Asistan silinemedi: '+(e.code||e.message))}
  };

  function injectDeleteButtons(){
    if(!canDeleteAssistant())return;
    const box=document.getElementById('users');if(!box)return;
    const rows=box.querySelectorAll('.item');
    rows.forEach((row,i)=>{
      const u=(window.usersData||[])[i];if(!u||u.uid===me.uid||u.role==='admin'||row.querySelector('.v6-delete-assistant'))return;
      const actions=row.querySelector('.actions')||row.querySelector('.row');if(!actions)return;
      const b=document.createElement('button');b.className='btn red s v6-delete-assistant';b.textContent='🗑️ Asistanı Sil';
      b.onclick=e=>{e.stopPropagation();deleteAssistantV6(u.uid)};actions.appendChild(b);
    });
  }
  const obs=new MutationObserver(()=>injectDeleteButtons());
  auth.onAuthStateChanged(u=>{if(!u)return;setTimeout(()=>{const box=document.getElementById('users');if(box){obs.observe(box,{childList:true,subtree:true});injectDeleteButtons()}},4500)});
})();