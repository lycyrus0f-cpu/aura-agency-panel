/* Aura Agency V6 - safe assistant removal + admin protection */
(function(){
  function canDeleteAssistant(){return !!me && me.role==='admin'}

  /* Prevent accidental role changes of ADMIN accounts in the UI. */
  const originalSetRole=window.setRole;
  window.setRole=async function(uid,role){
    const target=(usersData||[]).find(x=>x.uid===uid);
    if(!target)return alert('Kullanıcı bulunamadı.');
    if(target.role==='admin')return alert('🔒 ADMIN hesabının rolü değiştirilemez.');
    if(uid===me?.uid)return alert('Kendi hesabının rolünü buradan değiştiremezsin.');
    if(typeof originalSetRole==='function')return originalSetRole(uid,role);
  };

  window.deleteAssistantV6=async function(uid){
    if(!canDeleteAssistant())return alert('Asistan silme işlemini yalnızca ADMIN yapabilir.');
    if(uid===me.uid)return alert('🔒 Kendi ADMIN hesabını silemezsin.');
    const u=(usersData||[]).find(x=>x.uid===uid);
    if(!u)return alert('Kullanıcı bulunamadı.');
    if(u.role==='admin')return alert('🔒 ADMIN hesabı silinemez.');
    const label=u.name||u.email||uid;
    if(!confirm(`${label} hesabını panelden silmek istiyor musun?\n\nYayıncı, kota, ceza ve geçmiş kayıtları korunacak.`))return;
    if(!confirm('SON ONAY: Kullanıcının panel erişimi kaldırılacak. Devam edilsin mi?'))return;
    try{
      const ref=db.collection('users').doc(uid);
      const snap=await ref.get();
      if(!snap.exists)return alert('Kullanıcı kaydı zaten yok.');
      if(snap.data().role==='admin')return alert('🔒 ADMIN hesabı silinemez.');
      await db.collection('trash').doc(`user_${uid}_${Date.now()}`).set({
        type:'deletedUser',uid,userData:snap.data(),deletedAt:firebase.firestore.FieldValue.serverTimestamp(),deletedBy:me.uid
      });
      try{await db.collection('presence').doc(uid).delete()}catch(_){}
      await ref.delete();
      if(selectedUser?.uid===uid){selectedUser=null;const d=document.getElementById('assistantDetail');if(d)d.innerHTML='<div class="muted">Asistan silindi.</div>'}
      alert('✅ Asistan panelden silindi ve arşive alındı. Bu Firestore profili olmadan panele giriş yapamaz.');
    }catch(e){alert('Asistan silinemedi: '+(e.code||e.message))}
  };

  function injectDeleteButtons(){
    if(!canDeleteAssistant())return;
    const box=document.getElementById('users');if(!box)return;
    const rows=[...box.querySelectorAll('.item')];
    rows.forEach((row,i)=>{
      const u=(usersData||[])[i];
      if(!u||u.uid===me.uid||u.role==='admin'||row.querySelector('.v6-delete-assistant'))return;
      const actions=row.querySelector('.actions')||row.querySelector('.row');if(!actions)return;
      const b=document.createElement('button');b.className='btn red s v6-delete-assistant';b.textContent='🗑️ Asistanı Sil';
      b.onclick=e=>{e.stopPropagation();deleteAssistantV6(u.uid)};actions.appendChild(b);
    });
  }

  /* Hide role selector/buttons on admin cards, even if older renderer inserted them. */
  function protectAdminCards(){
    const box=document.getElementById('users');if(!box)return;
    const rows=[...box.querySelectorAll('.item')];
    rows.forEach((row,i)=>{
      const u=(usersData||[])[i];if(!u||u.role!=='admin')return;
      row.querySelectorAll('select, .v6-delete-assistant').forEach(x=>x.remove());
      if(!row.querySelector('.v6-admin-lock')){
        const tag=document.createElement('span');tag.className='badge v6-admin-lock';tag.textContent='🔒 ADMIN KORUMALI';
        (row.querySelector('.actions')||row.querySelector('.row'))?.appendChild(tag);
      }
    });
  }

  const obs=new MutationObserver(()=>{injectDeleteButtons();protectAdminCards()});
  auth.onAuthStateChanged(u=>{if(!u)return;setTimeout(()=>{const box=document.getElementById('users');if(box){obs.observe(box,{childList:true,subtree:true});injectDeleteButtons();protectAdminCards()}},4500)});
})();