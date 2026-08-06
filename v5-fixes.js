/* Aura Agency V5 hotfix: chat delete + announcement publish */
(function(){
  function canDeleteMessage(x){return !!me && (me.role==='admin' || (me.role==='ceo' && me.permissions?.manageChat===true) || x.senderUid===me.uid)}

  window.deleteChatMessage=async function(id){
    if(!id)return;
    if(!confirm('Bu mesaj silinsin mi?'))return;
    try{
      await db.collection('chats').doc('general').collection('messages').doc(id).delete();
      if(typeof v5Log==='function')v5Log('Chat mesajı silindi',id);
    }catch(e){
      alert('Mesaj silinemedi: '+(e.code||e.message));
    }
  };

  listenChat=function(){
    unsubs.push(db.collection('chats').doc('general').collection('messages').orderBy('createdAt','asc').limitToLast(100).onSnapshot(s=>{
      const box=$('chatBox');
      if(!box)return;
      box.innerHTML=s.docs.map(d=>{
        const x=d.data();
        const del=canDeleteMessage(x)?`<button class="btn r" style="padding:5px 8px;font-size:11px" onclick="deleteChatMessage('${d.id}')">Sil</button>`:'';
        return `<div class="msg ${x.senderUid===me.uid?'mine':''}"><div class="row"><b>${esc(x.senderName||'')}</b>${del}</div><div>${esc(x.text||'')}</div></div>`;
      }).join('');
      box.scrollTop=box.scrollHeight;
    },e=>{
      const box=$('chatBox');
      if(box)box.innerHTML='<div class="muted">Chat yüklenemedi: '+esc(e.code||e.message)+'</div>';
    }));
  };

  publishAnnouncement=async function(){
    const title=document.getElementById('announceTitle')?.value.trim()||'';
    const text=document.getElementById('announceText')?.value.trim()||'';
    if(!title||!text)return alert('Başlık ve mesaj gerekli.');
    if(!(me?.role==='admin' || (me?.role==='ceo' && me?.permissions?.manageAnnouncements===true)))return alert('Duyuru yayınlama yetkin yok.');
    try{
      await db.collection('announcements').add({
        title,text,createdBy:me.uid,createdByName:me.name||me.email,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      document.getElementById('announceTitle').value='';
      document.getElementById('announceText').value='';
      if(typeof v5Log==='function')v5Log('Duyuru yayınlandı',title);
      alert('✅ Duyuru yayınlandı.');
    }catch(e){
      alert('Duyuru yayınlanamadı: '+(e.code||e.message)+'\n\nEğer permission-denied yazıyorsa Firebase Firestore Rules ekranındaki güncel kuralları Publish etmemiz gerekiyor.');
    }
  };

  auth.onAuthStateChanged(u=>{
    if(!u)return;
    setTimeout(()=>{
      const chatBtn=document.querySelector('[data-s="chat"]');
      if(chatBtn)chatBtn.title='Kendi mesajını silebilirsin; admin tüm mesajları silebilir.';
    },300);
  });
})();