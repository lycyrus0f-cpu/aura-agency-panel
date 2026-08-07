/* Aura Agency V6: last login tracking and display */
(function(){
  function fmtLogin(ts){
    const d=ts?.toDate?.();
    return d?d.toLocaleString('tr-TR'):'Henüz kayıt yok';
  }

  auth.onAuthStateChanged(async u=>{
    if(!u)return;
    try{
      await db.collection('users').doc(u.uid).set({lastLoginAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    }catch(e){console.warn('lastLoginAt update failed',e)}
  });

  const prevRenderAssistant=window.renderAssistantManager;
  window.renderAssistantManager=function(){
    if(typeof prevRenderAssistant==='function')prevRenderAssistant();
    const el=document.getElementById('v5AssistantManager');
    if(!el||!Array.isArray(usersData))return;
    el.querySelectorAll('[data-user-login]').forEach(n=>n.remove());
    const cards=[...el.querySelectorAll('.item')];
    const rows=usersData.filter(u=>['assistant','ceo'].includes(u.role));
    cards.forEach((card,i)=>{
      const u=rows[i];if(!u)return;
      const line=document.createElement('div');
      line.dataset.userLogin='1';
      line.className='muted';
      line.style.marginTop='4px';
      line.textContent='🕒 Son giriş: '+fmtLogin(u.lastLoginAt);
      const target=card.querySelector('.row > div')||card;
      target.appendChild(line);
    });
  };

  const prevRenderSelected=window.renderSelected;
  window.renderSelected=function(){
    if(typeof prevRenderSelected==='function')prevRenderSelected();
    const el=document.getElementById('assistantDetail');
    if(!el||!selectedUser)return;
    let box=document.getElementById('v6SelectedLastLogin');
    if(!box){box=document.createElement('div');box.id='v6SelectedLastLogin';box.className='alert';box.style.marginTop='10px';el.prepend(box)}
    box.innerHTML='<b>🕒 Son giriş:</b> '+fmtLogin(selectedUser.lastLoginAt);
  };
})();