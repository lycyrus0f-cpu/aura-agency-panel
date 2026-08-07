/* Aura Agency V6 hotfix: reliable private messages using Firebase Auth session */
(function(){
  function activePrivateChatId(){
    if(window.AuraV6 && window.AuraV6.currentChat) return window.AuraV6.currentChat;
    const active=document.querySelector('[data-private-chat].on');
    return active?.dataset?.privateChat || null;
  }

  async function currentSender(){
    const u=auth.currentUser;
    if(!u) return null;
    let profile={};
    try{
      const d=await db.collection('users').doc(u.uid).get();
      if(d.exists) profile=d.data()||{};
    }catch(_){}
    return {uid:u.uid,email:u.email||profile.email||'',name:profile.name||u.displayName||u.email||'Kullanıcı'};
  }

  window.sendPrivateMessage=async function(){
    const inp=document.getElementById('privateChatInput');
    const text=inp?.value?.trim() || '';
    const chatId=activePrivateChatId();

    if(!chatId){alert('Önce bir özel sohbet seç.');return}
    if(!text) return;

    const sender=await currentSender();
    if(!sender){alert('Oturum bulunamadı. Çıkış yapıp yeniden giriş yap.');return}

    try{
      const chatRef=db.collection('chats').doc(chatId);
      const chatSnap=await chatRef.get();
      if(!chatSnap.exists){
        alert('Özel sohbet kaydı bulunamadı. Kişiyi yeniden seçip sohbeti aç.');
        return;
      }
      const data=chatSnap.data()||{};
      if(!Array.isArray(data.memberUids) || !data.memberUids.includes(sender.uid)){
        alert('Bu özel sohbete erişim yetkin bulunamadı.');
        return;
      }

      await chatRef.collection('messages').add({
        senderUid:sender.uid,
        senderName:sender.name,
        type:'text',
        text,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });

      await chatRef.update({updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      inp.value='';
      inp.focus();
      try{if(typeof signalTyping==='function') signalTyping()}catch(_){}
    }catch(e){
      console.error('V6 private message error',e);
      alert('Özel mesaj gönderilemedi: '+(e.code||e.message||e));
    }
  };

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-private-chat]');
    if(btn && window.AuraV6) window.AuraV6.currentChat=btn.dataset.privateChat;
  });
})();
