/* Aura Agency V5 hotfix: chat delete + announcements + assistant management + private chats */
(function(){
  function canDeleteMessage(x){return !!me && (me.role==='admin' || (me.role==='ceo' && me.permissions?.manageChat===true) || x.senderUid===me.uid)}

  window.deleteChatMessage=async function(id){
    if(!id||!confirm('Bu mesaj silinsin mi?'))return;
    try{await db.collection('chats').doc('general').collection('messages').doc(id).delete();if(typeof v5Log==='function')v5Log('Chat mesajı silindi',id)}
    catch(e){alert('Mesaj silinemedi: '+(e.code||e.message))}
  };

  listenChat=function(){
    unsubs.push(db.collection('chats').doc('general').collection('messages').orderBy('createdAt','asc').limitToLast(100).onSnapshot(s=>{
      const box=$('chatBox');if(!box)return;
      box.innerHTML=s.docs.map(d=>{const x=d.data();const del=canDeleteMessage(x)?`<button class="btn r" style="padding:5px 8px;font-size:11px" onclick="deleteChatMessage('${d.id}')">Sil</button>`:'';return `<div class="msg ${x.senderUid===me.uid?'mine':''}"><div class="row"><b>${esc(x.senderName||'')}</b>${del}</div><div>${esc(x.text||'')}</div></div>`}).join('');
      box.scrollTop=box.scrollHeight;
    },e=>{const box=$('chatBox');if(box)box.innerHTML='<div class="muted">Chat yüklenemedi: '+esc(e.code||e.message)+'</div>'}));
  };

  publishAnnouncement=async function(){
    const title=document.getElementById('announceTitle')?.value.trim()||'',text=document.getElementById('announceText')?.value.trim()||'';
    if(!title||!text)return alert('Başlık ve mesaj gerekli.');
    if(!(me?.role==='admin'||(me?.role==='ceo'&&me?.permissions?.manageAnnouncements===true)))return alert('Duyuru yayınlama yetkin yok.');
    try{await db.collection('announcements').add({title,text,createdBy:me.uid,createdByName:me.name||me.email,createdAt:firebase.firestore.FieldValue.serverTimestamp()});document.getElementById('announceTitle').value='';document.getElementById('announceText').value='';if(typeof v5Log==='function')v5Log('Duyuru yayınlandı',title);alert('✅ Duyuru yayınlandı.')}
    catch(e){alert('Duyuru yayınlanamadı: '+(e.code||e.message)+'\n\npermission-denied ise Firebase Firestore Rules ekranında güncel kuralları Publish et.')}
  };

  let privateUnsub=null,currentPrivateChat=null,privateChats=[];
  function privateChatId(a,b){return 'private_'+[a,b].sort().join('_')}

  window.openPrivateChatWith=async function(uid){
    if(!me||uid===me.uid)return;
    const other=usersData.find(u=>u.uid===uid);
    const id=privateChatId(me.uid,uid);
    try{
      await db.collection('chats').doc(id).set({type:'private',name:`${me.name||me.email} ↔ ${other?.name||other?.email||uid}`,memberUids:[me.uid,uid],updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
      document.querySelector('#v5PrivateBtn')?.click();
      setTimeout(()=>selectPrivateChat(id),100);
      if(typeof v5Log==='function')v5Log('Özel sohbet açıldı',other?.name||other?.email||uid);
    }catch(e){alert('Özel sohbet açılamadı: '+(e.code||e.message))}
  };

  window.selectPrivateChat=function(id){
    currentPrivateChat=id;
    document.querySelectorAll('[data-private-chat]').forEach(x=>x.classList.toggle('on',x.dataset.privateChat===id));
    if(privateUnsub)privateUnsub();
    const box=document.getElementById('privateChatBox');if(box)box.innerHTML='<div class="muted">Mesajlar yükleniyor...</div>';
    privateUnsub=db.collection('chats').doc(id).collection('messages').orderBy('createdAt','asc').limitToLast(100).onSnapshot(s=>{
      if(!box)return;box.innerHTML=s.docs.map(d=>{const x=d.data();const del=canDeleteMessage(x)?`<button class="btn r" style="padding:4px 7px;font-size:11px" onclick="deletePrivateMessage('${id}','${d.id}')">Sil</button>`:'';return `<div class="msg ${x.senderUid===me.uid?'mine':''}"><div class="row"><b>${esc(x.senderName||'')}</b>${del}</div><div>${esc(x.text||'')}</div></div>`}).join('')||'<div class="muted">Henüz mesaj yok.</div>';box.scrollTop=box.scrollHeight;
    },e=>{if(box)box.innerHTML='<div class="muted">Mesajlar yüklenemedi: '+esc(e.code||e.message)+'</div>'});
  };

  window.sendPrivateMessage=async function(){
    const inp=document.getElementById('privateChatInput'),t=inp?.value.trim();if(!currentPrivateChat||!t)return;
    try{await db.collection('chats').doc(currentPrivateChat).collection('messages').add({senderUid:me.uid,senderName:me.name||me.email,text:t,createdAt:firebase.firestore.FieldValue.serverTimestamp()});await db.collection('chats').doc(currentPrivateChat).update({updatedAt:firebase.firestore.FieldValue.serverTimestamp()});inp.value=''}catch(e){alert('Özel mesaj gönderilemedi: '+(e.code||e.message))}
  };

  window.deletePrivateMessage=async function(chatId,msgId){if(!confirm('Bu özel mesaj silinsin mi?'))return;try{await db.collection('chats').doc(chatId).collection('messages').doc(msgId).delete()}catch(e){alert('Mesaj silinemedi: '+(e.code||e.message))}};

  function mountPrivateMessages(){
    const app=document.getElementById('app'),nav=document.getElementById('nav');if(!app||!nav||document.getElementById('privateMessages'))return;
    const b=document.createElement('button');b.id='v5PrivateBtn';b.textContent='💬 Özel Mesajlar';b.onclick=()=>{document.querySelectorAll('#nav button').forEach(x=>x.classList.remove('on'));document.querySelectorAll('.sec').forEach(x=>x.classList.remove('on'));b.classList.add('on');document.getElementById('privateMessages').classList.add('on')};nav.appendChild(b);
    const sec=document.createElement('section');sec.id='privateMessages';sec.className='sec';sec.innerHTML=`<div class="grid"><div class="card"><h2>💬 Özel Sohbetler</h2><div class="muted">Bu konuşmaları yalnızca sohbet üyeleri görebilir.</div><div id="privateChatList" class="list" style="margin-top:12px"></div></div><div class="card"><h2>Mesajlar</h2><div id="privateChatBox" class="chatbox" style="min-height:360px;max-height:520px"></div><div class="row" style="margin-top:10px"><input id="privateChatInput" placeholder="Özel mesaj yaz..." onkeydown="if(event.key==='Enter')sendPrivateMessage()"><button class="btn" onclick="sendPrivateMessage()">Gönder</button></div></div></div>`;app.appendChild(sec);
    unsubs.push(db.collection('chats').where('memberUids','array-contains',me.uid).onSnapshot(s=>{privateChats=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.type==='private');const list=document.getElementById('privateChatList');if(!list)return;list.innerHTML=privateChats.map(c=>{const otherUid=(c.memberUids||[]).find(x=>x!==me.uid),u=usersData.find(x=>x.uid===otherUid);return `<button class="item" style="width:100%;text-align:left" data-private-chat="${c.id}" onclick="selectPrivateChat('${c.id}')"><b>${esc(u?.name||u?.email||c.name||'Özel Sohbet')}</b><div class="muted">Özel konuşma</div></button>`}).join('')||'<div class="muted">Henüz özel sohbet yok.</div>'},e=>{const list=document.getElementById('privateChatList');if(list)list.innerHTML='<div class="muted">Özel sohbetler yüklenemedi: '+esc(e.code||e.message)+'</div>'}));
  }

  window.deleteAssistantV5=async function(uid){
    if(me?.role!=='admin')return alert('Sadece ADMIN asistan silebilir.');
    const u=usersData.find(x=>x.uid===uid);if(!u||u.role==='admin')return;
    if(!confirm(`${u.name||u.email} adlı asistan panelden silinsin mi?`))return;
    if(!confirm('EMİN MİSİN? Kullanıcı panel erişimini kaybedecek. Yayıncı kayıtları silinmeyecek.'))return;
    try{
      await db.collection('trash').add({type:'user',originalId:uid,data:u,deletedAt:firebase.firestore.FieldValue.serverTimestamp(),deletedBy:me.uid});
      await db.collection('users').doc(uid).delete();
      if(typeof v5Log==='function')v5Log('Asistan silindi',u.name||u.email||uid);
      alert('✅ Asistan panelden silindi.\n\nNot: Firebase Authentication hesabı güvenlik nedeniyle tarayıcıdan başka kullanıcı adına tamamen silinemez. Kullanıcı Firestore profili olmadığı için panele giriş yapamaz. Authentication kaydını da tamamen silmek istersen Firebase Console > Authentication > Users bölümünden silebilirsin.');
    }catch(e){alert('Asistan silinemedi: '+(e.code||e.message))}
  };

  function mountAssistantManager(){
    if(!isManager()||document.getElementById('v5AssistantManager'))return;
    const suite=document.getElementById('v5suite');if(!suite)return;
    const card=document.createElement('div');card.id='v5AssistantManager';card.className='card';card.style.marginTop='12px';suite.prepend(card);renderAssistantManager();
  }
  window.renderAssistantManager=function(){
    const el=document.getElementById('v5AssistantManager');if(!el)return;
    const rows=usersData.filter(u=>['assistant','ceo'].includes(u.role));
    el.innerHTML=`<div class="row"><div><h2>👥 Asistan Yönetimi</h2><div class="muted">Asistanı yönet, özelden yaz veya panel erişimini sil.</div></div></div><div class="list" style="margin-top:10px">${rows.map(u=>`<div class="item"><div class="row"><div><b>${esc(u.name||u.email)}</b><div class="muted">${esc(u.email||'')} • ${esc(u.role||'assistant')}</div></div><div class="actions"><button class="btn g s" onclick="openPrivateChatWith('${u.uid}')">💬 Özel Mesaj</button>${me.role==='admin'?`<button class="btn r s" onclick="deleteAssistantV5('${u.uid}')">🗑️ Asistanı Sil</button>`:''}</div></div></div>`).join('')||'<div class="muted">Asistan yok.</div>'}</div>`;
  };

  const oldV5Render=typeof v5Render==='function'?v5Render:null;
  if(oldV5Render){v5Render=function(){oldV5Render();mountAssistantManager();renderAssistantManager()}}

  auth.onAuthStateChanged(u=>{if(!u)return;setTimeout(()=>{mountPrivateMessages();mountAssistantManager();renderAssistantManager();const chatBtn=document.querySelector('[data-s="chat"]');if(chatBtn)chatBtn.title='Kendi mesajını silebilirsin; admin tüm mesajları silebilir.'},700)});
})();