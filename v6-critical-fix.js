/* Aura Agency V6 critical fix: reliable two-way WebRTC audio + owner admin self-heal */
(function(){
  const OWNER_EMAIL='ly.cyrus0f@gmail.com';
  const ts=()=>firebase.firestore.FieldValue.serverTimestamp();

  /* Owner account can self-heal its Firestore role after login. Rules also protect it. */
  auth.onAuthStateChanged(async u=>{
    if(!u || String(u.email||'').toLowerCase()!==OWNER_EMAIL)return;
    try{
      await db.collection('users').doc(u.uid).set({role:'admin',owner:true,updatedAt:ts()},{merge:true});
      if(typeof me!=='undefined' && me && me.uid===u.uid){
        me.role='admin';me.owner=true;
        const roleEl=document.getElementById('urole');if(roleEl)roleEl.textContent='ADMIN';
        document.querySelectorAll('.mgr,.manager').forEach(x=>x.style.display='');
      }
    }catch(e){console.warn('Owner role self-heal failed',e)}
  });

  function v6(){return window.AuraV6}
  function rtc(){return new RTCPeerConnection({iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']} ]})}
  async function getMic(){return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}
  function nameOf(uid){const u=(typeof usersData!=='undefined'?usersData:[]).find(x=>x.uid===uid);return u?.name||u?.email||uid}

  function showModal(title,name,incoming=false){
    let m=document.getElementById('v6CallModal');if(!m){m=document.createElement('div');m.id='v6CallModal';m.className='v6-call-modal';document.body.appendChild(m)}
    const first=(name||'A')[0]?.toUpperCase()||'A';
    m.innerHTML=`<div class="v6-call-card"><div class="v6-call-avatar v6-pulse" style="display:grid;place-items:center;background:#6f43dc;font-size:38px;font-weight:900">${typeof esc==='function'?esc(first):first}</div><h2>${typeof esc==='function'?esc(title):title}</h2><div style="font-size:20px;font-weight:800">${typeof esc==='function'?esc(name):name}</div><div id="v6CallStatus" class="muted" style="margin-top:8px">${incoming?'Gelen sesli arama':'Bağlanıyor…'}</div><div class="v6-call-actions">${incoming?'<button class="btn g" onclick="acceptVoiceCall()">✅ Kabul</button><button class="btn r" onclick="rejectVoiceCall()">❌ Reddet</button>':'<button class="btn r" onclick="endVoiceCall()">📵 Kapat</button>'}</div><audio id="v6RemoteAudio" autoplay playsinline></audio></div>`;
    m.style.display='flex';
    attachStoredRemote();
  }
  function hideModal(){const m=document.getElementById('v6CallModal');if(m)m.style.display='none'}
  function attachRemote(stream){
    const V=v6();if(!V)return;V.remoteStream=stream;
    const a=document.getElementById('v6RemoteAudio');
    if(a){a.srcObject=stream;a.muted=false;a.volume=1;const p=a.play();if(p?.catch)p.catch(()=>{})}
  }
  function attachStoredRemote(){const V=v6();if(V?.remoteStream)attachRemote(V.remoteStream)}
  function cleanup(){
    const V=v6();if(!V)return;
    try{V.callUnsubs?.forEach(u=>u&&u())}catch(_){}V.callUnsubs=[];
    try{V.pc?.close()}catch(_){};
    V.localStream?.getTracks?.().forEach(t=>t.stop());
    V.pc=null;V.localStream=null;V.remoteStream=null;V.activeCall=null;V.ring=null;hideModal();
  }

  window.startVoiceCall=async function(uid){
    const V=v6();if(!V||!uid||uid===me.uid)return;
    cleanup();
    try{
      const ref=db.collection('calls').doc(),pc=rtc(),stream=await getMic();
      V.pc=pc;V.localStream=stream;V.activeCall={id:ref.id,ref,otherUid:uid,role:'caller'};
      showModal('Aranıyor',nameOf(uid),false);
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      pc.ontrack=e=>attachRemote(e.streams?.[0]||new MediaStream([e.track]));
      pc.onicecandidate=e=>{if(e.candidate)ref.collection('callerCandidates').add(e.candidate.toJSON()).catch(()=>{})};
      pc.onconnectionstatechange=()=>{const st=document.getElementById('v6CallStatus');if(st&&pc.connectionState==='connected')st.textContent='🔊 Görüşme başladı'};
      const offer=await pc.createOffer({offerToReceiveAudio:true});await pc.setLocalDescription(offer);
      await ref.set({callerUid:me.uid,callerName:me.name||me.email,calleeUid:uid,calleeName:nameOf(uid),memberUids:[me.uid,uid],status:'ringing',offer:{type:offer.type,sdp:offer.sdp},startedAt:ts(),updatedAt:ts()});
      const u1=ref.onSnapshot(async d=>{if(!d.exists)return;const x=d.data();if(x.answer&&!pc.currentRemoteDescription){await pc.setRemoteDescription(new RTCSessionDescription(x.answer));attachStoredRemote()}const st=document.getElementById('v6CallStatus');if(st)st.textContent=x.status==='active'?'🔊 Görüşme başladı':x.status==='rejected'?'Arama reddedildi':x.status==='ended'?'Arama bitti':'Çalıyor…';if(['rejected','ended','missed'].includes(x.status))setTimeout(cleanup,400)});
      const u2=ref.collection('calleeCandidates').onSnapshot(s=>s.docChanges().forEach(async c=>{if(c.type==='added')try{await pc.addIceCandidate(new RTCIceCandidate(c.doc.data()))}catch(_){}}));
      V.callUnsubs.push(u1,u2);
    }catch(e){cleanup();alert('Arama başlatılamadı: '+(e.code||e.message||e))}
  };

  window.acceptVoiceCall=async function(){
    const V=v6(),ring=V?.ring;if(!V||!ring)return;
    try{
      const pc=rtc(),stream=await getMic();V.pc=pc;V.localStream=stream;V.activeCall={id:ring.id,ref:ring.ref,otherUid:ring.data.callerUid,role:'callee'};
      /* IMPORTANT: create the audio element BEFORE applying remote description. */
      showModal('Görüşme',ring.data.callerName||nameOf(ring.data.callerUid),false);
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      pc.ontrack=e=>attachRemote(e.streams?.[0]||new MediaStream([e.track]));
      pc.onicecandidate=e=>{if(e.candidate)ring.ref.collection('calleeCandidates').add(e.candidate.toJSON()).catch(()=>{})};
      pc.onconnectionstatechange=()=>{const st=document.getElementById('v6CallStatus');if(st&&pc.connectionState==='connected')st.textContent='🔊 Görüşme başladı'};
      await pc.setRemoteDescription(new RTCSessionDescription(ring.data.offer));attachStoredRemote();
      const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
      await ring.ref.update({answer:{type:answer.type,sdp:answer.sdp},status:'active',answeredAt:ts(),updatedAt:ts()});
      const u=ring.ref.collection('callerCandidates').onSnapshot(s=>s.docChanges().forEach(async c=>{if(c.type==='added')try{await pc.addIceCandidate(new RTCIceCandidate(c.doc.data()))}catch(_){}}));
      const uStatus=ring.ref.onSnapshot(d=>{const x=d.data();if(x&&['ended','rejected','missed'].includes(x.status))setTimeout(cleanup,250)});
      V.callUnsubs.push(u,uStatus);V.ring=null;
      const a=document.getElementById('v6RemoteAudio');if(a){a.muted=false;const p=a.play();if(p?.catch)p.catch(()=>{})}
    }catch(e){cleanup();alert('Arama kabul edilemedi: '+(e.code||e.message||e))}
  };

  window.endVoiceCall=async function(){const V=v6(),c=V?.activeCall;if(c)await c.ref.update({status:'ended',endedAt:ts(),updatedAt:ts()}).catch(()=>{});cleanup()};

  /* Prevent the owner from being demoted through the UI. */
  const originalSetRole=typeof setRole==='function'?setRole:null;
  if(originalSetRole){
    setRole=async function(uid,role){
      const u=(usersData||[]).find(x=>x.uid===uid);
      if(String(u?.email||'').toLowerCase()===OWNER_EMAIL)return alert('Ana ADMIN hesabının rolü değiştirilemez.');
      return originalSetRole(uid,role);
    };
  }
})();