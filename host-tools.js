/* Aura Agency host tools: search, WhatsApp normalization and full edit modal */
(function(){
  let hostSearch='';
  let editingHostId=null;

  function digits(v){return String(v||'').replace(/\D/g,'')}
  function normalizeWhatsAppPhone(v){
    let p=digits(v);
    if(!p)return '';
    if(p.startsWith('00'))p=p.slice(2);
    if(p.startsWith('994'))return p;
    if(/^0\d{9}$/.test(p))return '994'+p.slice(1);
    if(/^\d{9}$/.test(p)&&/^(10|50|51|55|60|70|77|99)/.test(p))return '994'+p;
    return p;
  }
  function hostCanEdit(h){
    return !!me && (me.role==='admin' || (me.role==='ceo'&&me.permissions?.manageHosts===true) || h.ownerUid===me.uid);
  }

  window.openWhats=function(phone){
    const p=normalizeWhatsAppPhone(phone);
    if(!p)return alert('Bu yayıncı için telefon numarası kayıtlı değil.');
    const url='https://wa.me/'+p;
    const w=window.open(url,'_blank','noopener,noreferrer');
    if(!w)window.location.href=url;
  };

  function ensureHostSearch(){
    const list=document.getElementById('hostList');
    if(!list||document.getElementById('hostSearch'))return;
    const input=document.createElement('input');
    input.id='hostSearch';
    input.placeholder='🔎 İsim, SOYO ID veya telefon ile ara...';
    input.autocomplete='off';
    input.style.margin='10px 0 12px';
    input.oninput=()=>{hostSearch=input.value||'';renderHosts()};
    list.parentNode.insertBefore(input,list);
  }

  function ensureHostEditModal(){
    if(document.getElementById('hostEditModal'))return;
    const modal=document.createElement('div');
    modal.id='hostEditModal';
    modal.className='modal hide';
    modal.innerHTML=`<div class="box">
      <div class="row"><h2>✏️ Yayıncıyı Düzenle</h2><button class="btn s" onclick="closeHostEdit()">Kapat</button></div>
      <label>İsim</label><input id="editHostName">
      <label>SOYO ID</label><input id="editHostSoyoId">
      <label>Telefon</label><input id="editHostPhone" inputmode="tel" placeholder="Örn: 0501234567">
      <label>Kota</label><input id="editHostQuota" type="number" min="0" step="1">
      <label>Durum</label><select id="editHostStatus"><option value="Aktif">Aktif</option><option value="Pasif">Pasif</option><option value="İzinli">İzinli</option></select>
      <div class="actions" style="margin-top:14px"><button class="btn g" style="flex:1" onclick="saveHostEdit()">💾 Değişiklikleri Kaydet</button></div>
      <div id="editHostInfo" class="alert">İsim, ID, telefon, kota ve durumu değiştirebilirsin.</div>
    </div>`;
    document.body.appendChild(modal);
  }

  window.openHostEdit=function(id){
    const h=hosts.find(x=>x.id===id);
    if(!h)return alert('Yayıncı bulunamadı.');
    if(!hostCanEdit(h))return alert('Bu yayıncıyı düzenleme yetkin yok.');
    ensureHostEditModal();
    editingHostId=id;
    document.getElementById('editHostName').value=h.name||'';
    document.getElementById('editHostSoyoId').value=h.soyoId||'';
    document.getElementById('editHostPhone').value=h.phone||'';
    document.getElementById('editHostQuota').value=Number(h.quota||0);
    document.getElementById('editHostStatus').value=['Aktif','Pasif','İzinli'].includes(h.status)?h.status:'Aktif';
    document.getElementById('editHostInfo').textContent='İstediğin alanı değiştirip kaydedebilirsin.';
    document.getElementById('hostEditModal').classList.remove('hide');
  };

  window.closeHostEdit=function(){
    document.getElementById('hostEditModal')?.classList.add('hide');
    editingHostId=null;
  };

  window.saveHostEdit=async function(){
    if(!editingHostId)return;
    const h=hosts.find(x=>x.id===editingHostId);
    if(!h||!hostCanEdit(h))return alert('Düzenleme yetkin yok.');
    const name=document.getElementById('editHostName').value.trim();
    const soyoId=document.getElementById('editHostSoyoId').value.trim();
    const phone=document.getElementById('editHostPhone').value.trim();
    const quota=Math.max(0,Number(document.getElementById('editHostQuota').value||0));
    const status=document.getElementById('editHostStatus').value;
    if(!name||!soyoId)return alert('İsim ve SOYO ID boş bırakılamaz.');
    const info=document.getElementById('editHostInfo');
    try{
      info.textContent='Kaydediliyor...';
      await db.collection('hosts').doc(editingHostId).update({name,soyoId,phone,quota,status,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:me.uid});
      if(typeof v5Log==='function')v5Log('Yayıncı düzenlendi',`${name} • ${soyoId}`);
      info.textContent='✅ Değişiklikler kaydedildi.';
      setTimeout(closeHostEdit,450);
    }catch(e){
      info.textContent='❌ Kaydedilemedi: '+(e.code||e.message);
    }
  };

  renderHosts=function(){
    ensureHostSearch();
    ensureHostEditModal();
    const q=String(document.getElementById('hostSearch')?.value||hostSearch).trim().toLocaleLowerCase('tr-TR');
    const qDigits=digits(q);
    const rows=!q?hosts:hosts.filter(h=>{
      const name=String(h.name||'').toLocaleLowerCase('tr-TR');
      const id=String(h.soyoId||'').toLocaleLowerCase('tr-TR');
      const phone=digits(h.phone||'');
      return name.includes(q)||id.includes(q)||(qDigits&&phone.includes(qDigits));
    });
    const list=document.getElementById('hostList');if(!list)return;
    list.innerHTML=rows.length?rows.map(h=>{
      const phone=String(h.phone||'').trim();
      const canEdit=hostCanEdit(h);
      return `<div class="item">
        <div class="row"><div><b>${esc(h.name||'')}</b><div class="muted">ID ${esc(h.soyoId||'')} • 📱 ${esc(phone||'Telefon yok')}</div></div><span class="tag">${esc(h.status||'Aktif')}</span></div>
        <div style="margin-top:8px">Kota: <b>${fmt(h.quota)}</b> 💎 • ${money(Number(h.quota||0)/22000)} USD</div>
        <div class="actions" style="margin-top:10px">
          <button class="btn g" ${phone?'':'disabled'} onclick="openWhats('${esc(phone)}')">🟢 WhatsApp</button>
          ${canEdit?`<button class="btn s" onclick="openHostEdit('${h.id}')">✏️ Düzenle</button><button class="btn r" onclick="delHost('${h.id}')">🗑️ Sil</button>`:''}
        </div>
      </div>`;
    }).join(''):`<div class="muted">${q?'Aramana uyğun yayıncı bulunamadı.':'Bu hafta yayıncı yok.'}</div>`;
  };

  function boot(){ensureHostSearch();ensureHostEditModal();try{renderHosts()}catch(_){}}
  auth.onAuthStateChanged(u=>{if(u)setTimeout(boot,900)});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,300));
})();
