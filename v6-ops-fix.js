/* Aura Agency V6 Ops Fix: host editing + leave requests / approved leave penalty protection */
(function(){
  const OPS={leaveRequests:[],leaveUnsub:null};
  window.AuraOps=OPS;
  const ts=()=>firebase.firestore.FieldValue.serverTimestamp();
  const fmtDate=d=>String(d||'');
  const todayKey=()=>new Date().toISOString().slice(0,10);
  const manager=()=>!!me&&['admin','ceo'].includes(me.role);
  const canManageLeave=()=>!!me&&(me.role==='admin'||(me.role==='ceo'&&me.permissions?.managePenalties===true));

  /* ---------- HOST / QUOTA EDITING ---------- */
  window.editHostV6=async function(id){
    const h=(hosts||[]).find(x=>x.id===id);if(!h)return alert('Yayıncı bulunamadı.');
    if(!(me?.role==='admin'||(h.ownerUid===me?.uid)||(me?.role==='ceo'&&me?.permissions?.manageHosts===true)))return alert('Bu yayıncıyı düzenleme yetkin yok.');
    const name=prompt('Yayıncı adı:',h.name||'');if(name===null)return;
    const soyoId=prompt('SOYO ID:',h.soyoId||'');if(soyoId===null)return;
    const phone=prompt('Telefon:',h.phone||'');if(phone===null)return;
    const quotaRaw=prompt('Kota (elmas):',String(h.quota||0));if(quotaRaw===null)return;
    const quota=typeof parseQ==='function'?parseQ(quotaRaw):Number(String(quotaRaw).replace(/\./g,'').replace(',','.'))||0;
    const status=prompt('Durum (Aktif / Pasif / İzinli):',h.status||'Aktif');if(status===null)return;
    try{
      await db.collection('hosts').doc(id).update({name:name.trim()||h.name,soyoId:soyoId.trim()||h.soyoId,phone:phone.trim(),quota,status:status.trim()||'Aktif',updatedAt:ts(),updatedBy:me.uid});
      alert('✅ Yayıncı bilgileri ve kotası güncellendi.');
    }catch(e){alert('Yayıncı güncellenemedi: '+(e.code||e.message))}
  };

  const baseRenderHosts=window.renderHosts;
  window.renderHosts=function(){
    const list=document.getElementById('hostList');
    if(!list){if(baseRenderHosts)baseRenderHosts();return}
    list.innerHTML=(hosts||[]).length?(hosts||[]).map(h=>{
      const editable=me?.role==='admin'||h.ownerUid===me?.uid||(me?.role==='ceo'&&me?.permissions?.manageHosts===true);
      return `<div class="item"><div class="row"><div><b>${esc(h.name)}</b><div class="muted">ID ${esc(h.soyoId)} • ${esc(h.phone||'')} • ${esc(h.status||'Aktif')}</div></div><div class="actions">${editable?`<button class="btn s" onclick="editHostV6('${h.id}')">✏️ Düzenle</button>`:''}<button class="btn red s" onclick="delHost('${h.id}')">Sil</button></div></div><div style="margin-top:8px">Kota: <b>${fmt(h.quota)}</b> 💎 • ${money(Number(h.quota||0)/22000)} USD</div><div class="actions" style="margin-top:8px"><button class="btn green" onclick="openWhats('${esc(h.phone||'')}')">WhatsApp</button>${editable?`<button class="btn" onclick="editHostV6('${h.id}')">💎 Kota / Bilgi Güncelle</button>`:''}</div></div>`
    }).join(''):'<div class="muted">Bu hafta yayıncı yok.</div>';
  };

  /* ---------- LEAVE REQUESTS ---------- */
  function leaveDocId(uid,date){return `${uid}_${date}`}
  window.requestLeaveV6=async function(){
    if(!me)return;
    const date=document.getElementById('v6LeaveDate')?.value||todayKey();
    const reason=document.getElementById('v6LeaveReason')?.value.trim()||'';
    if(!date)return alert('İzin tarihi seç.');
    if(reason.length<3)return alert('İzin sebebini yaz.');
    const ref=db.collection('leaveRequests').doc(leaveDocId(me.uid,date));
    try{
      const old=await ref.get();
      if(old.exists&&old.data().status==='approved')return alert('Bu tarih zaten İZİNLİ olarak onaylandı.');
      await ref.set({assistantUid:me.uid,assistantName:me.name||me.email,date,reason,status:'pending',cycleNumber:Number(currentCycle.number||1),requestedAt:ts(),reviewedAt:null,reviewedBy:null,reviewNote:''},{merge:true});
      document.getElementById('v6LeaveReason').value='';
      alert('✅ İzin talebi yönetime gönderildi. Onaylanınca o gün 05:00 kapanış cezası yazılmayacak.');
    }catch(e){alert('İzin talebi gönderilemedi: '+(e.code||e.message))}
  };

  window.cancelLeaveV6=async function(id){
    const x=OPS.leaveRequests.find(r=>r.id===id);if(!x||x.assistantUid!==me?.uid||x.status!=='pending')return;
    if(!confirm('İzin talebi iptal edilsin mi?'))return;
    try{await db.collection('leaveRequests').doc(id).delete()}catch(e){alert('Talep silinemedi: '+(e.code||e.message))}
  };

  window.reviewLeaveV6=async function(id,status){
    if(!canManageLeave())return alert('İzin onaylama yetkin yok.');
    const x=OPS.leaveRequests.find(r=>r.id===id);if(!x)return;
    let note='';if(status==='rejected')note=prompt('Red sebebi:')||'';
    try{
      await db.collection('leaveRequests').doc(id).update({status,reviewNote:note,reviewedAt:ts(),reviewedBy:me.uid});
      if(status==='approved'){
        const pid=`finish_${x.assistantUid}_${x.date}`;
        const p=await db.collection('penalties').doc(pid).get();
        if(p.exists&&p.data().auto===true)await p.ref.delete();
        alert('✅ Asistan İZİNLİ olarak onaylandı. Bu tarih için otomatik 05:00 cezası yazılmayacak. Varsa otomatik ceza kaldırıldı.');
      }
    }catch(e){alert('İzin işlemi yapılamadı: '+(e.code||e.message))}
  };

  function badge(s){return s==='approved'?'✅ İZİNLİ':s==='rejected'?'❌ Reddedildi':'⏳ Onay Bekliyor'}
  function renderLeavePanels(){
    const own=document.getElementById('v6OwnLeaveList');
    if(own){const rows=OPS.leaveRequests.filter(x=>x.assistantUid===me?.uid).sort((a,b)=>String(b.date).localeCompare(String(a.date)));own.innerHTML=rows.map(x=>`<div class="item"><div class="row"><div><b>${fmtDate(x.date)} • ${badge(x.status)}</b><div>${esc(x.reason||'')}</div>${x.reviewNote?`<div class="muted">Yönetim: ${esc(x.reviewNote)}</div>`:''}</div>${x.status==='pending'?`<button class="btn r s" onclick="cancelLeaveV6('${x.id}')">İptal</button>`:''}</div></div>`).join('')||'<div class="muted">İzin talebin yok.</div>'}
    const admin=document.getElementById('v6LeaveAdminList');
    if(admin){const rows=OPS.leaveRequests.filter(x=>x.status==='pending').sort((a,b)=>String(a.date).localeCompare(String(b.date)));admin.innerHTML=rows.map(x=>`<div class="item"><div class="row"><div><b>${esc(x.assistantName||x.assistantUid)}</b><div>📅 ${esc(x.date)} • ${esc(x.reason||'')}</div></div><div class="actions"><button class="btn g s" onclick="reviewLeaveV6('${x.id}','approved')">✅ İzinli</button><button class="btn r s" onclick="reviewLeaveV6('${x.id}','rejected')">Reddet</button></div></div></div>`).join('')||'<div class="muted">Bekleyen izin talebi yok.</div>'}
  }

  function mountLeaveUI(){
    const work=document.getElementById('work');
    if(work&&!document.getElementById('v6LeaveCard')){
      const card=document.createElement('div');card.id='v6LeaveCard';card.className='card';card.style.marginTop='12px';card.innerHTML=`<h2>🏖️ İzin Talebi</h2><p class="muted">İzin istediğin günü yönetime gönder. Yönetim <b>İzinli</b> olarak onaylarsa o gün 05:00 iş bitirme cezası uygulanmaz.</p><label>İzin tarihi</label><input id="v6LeaveDate" type="date" value="${todayKey()}"><label>Sebep</label><textarea id="v6LeaveReason" placeholder="İzin sebebi..." style="min-height:85px"></textarea><button class="btn g" onclick="requestLeaveV6()">İzin İste</button><h3 style="margin-top:18px">İzinlerim</h3><div id="v6OwnLeaveList" class="list"></div>`;work.appendChild(card);
    }
    const adminSec=document.getElementById('admin');
    if(adminSec&&manager()&&!document.getElementById('v6LeaveAdmin')){
      const card=document.createElement('div');card.id='v6LeaveAdmin';card.className='card';card.style.marginTop='12px';card.innerHTML=`<div class="row"><div><h2>🏖️ Asistan İzin Onayları</h2><div class="muted">Onaylanan gün için otomatik 05:00 cezası engellenir.</div></div></div><div id="v6LeaveAdminList" class="list" style="margin-top:12px"></div>`;adminSec.appendChild(card);
    }
    renderLeavePanels();
  }

  function listenLeaves(){
    if(OPS.leaveUnsub)OPS.leaveUnsub();
    let q=db.collection('leaveRequests');if(me?.role==='assistant')q=q.where('assistantUid','==',me.uid);
    OPS.leaveUnsub=q.onSnapshot(s=>{OPS.leaveRequests=s.docs.map(d=>({id:d.id,...d.data()}));mountLeaveUI();renderLeavePanels()},e=>{console.warn('leaveRequests',e)});
  }

  /* Replace legacy automatic penalty checker: approved leave = no finish penalty. */
  window.checkMissedFinishPenalties=async function(){
    if(!can('managePenalties'))return;
    const now=new Date();if(now.getHours()<6)return;
    const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);const key=typeof dayKey==='function'?dayKey(yesterday):yesterday.toISOString().slice(0,10);
    for(const u of (usersData||[]).filter(x=>['assistant','ceo'].includes(x.role))){
      const leave=await db.collection('leaveRequests').doc(leaveDocId(u.uid,key)).get();
      const pid=`finish_${u.uid}_${key}`,pref=db.collection('penalties').doc(pid);
      if(leave.exists&&leave.data().status==='approved'){
        const pd=await pref.get();if(pd.exists&&pd.data().auto===true)await pref.delete();continue;
      }
      const wd=await db.collection('workEnd').doc(`${u.uid}_${key}`).get(),pd=await pref.get();
      if(!wd.exists&&!pd.exists)await pref.set({assistantUid:u.uid,amount:Number(settings.finishPenalty||5),reason:'05:00 iş bitirme yapılmadı',date:key,auto:true,cycleNumber:currentCycle.number||1,createdAt:ts(),createdBy:me.uid});
    }
  };

  auth.onAuthStateChanged(u=>{if(!u)return;setTimeout(()=>{mountLeaveUI();listenLeaves();try{renderHosts()}catch(_){}},900)});
})();