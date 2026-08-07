/* Aura Agency V6 hotfix: make private text messages use the V6 active chat */
(function(){
  function activePrivateChatId(){
    if(window.AuraV6 && window.AuraV6.currentChat) return window.AuraV6.currentChat;
    const active=document.querySelector('[data-private-chat].on');
    return active?.dataset?.privateChat || null;
  }

  window.sendPrivateMessage=async function(){
    const inp=document.getElementById('privateChatInput');
    const text=inp?.value?.trim() || '';
    const chatId=activePrivateChatId();

    if(!chatId){
      alert('Önce bir özel sohbet seç.');
      return;
    }
    if(!text) return;
    if(!window.me?.uid){
      alert('Oturum bilgisi bulunamadı. Sayfayı yenileyip tekrar giriş yap.');
      return;
    }

    try{
      const chatRef=db.collection('chats').doc(chatId);
      await chatRef.set({
        type:'private',
        memberUids: firebase.firestore.FieldValue.arrayUnion(me.uid),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});

      await chatRef.collection('messages').add({
        senderUid:me.uid,
        senderName:me.name||me.email||'Kullanıcı',
        type:'text',
        text,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });

      await chatRef.update({updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      inp.value='';
      inp.focus();
      if(typeof signalTyping==='function') signalTyping();
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
