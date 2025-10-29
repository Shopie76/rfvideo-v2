import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const CFG_KEY='RFV2_CONFIG', ADMIN_KEY='RFV2_ADMIN_UIDS';
function readConfig(){
  const raw = localStorage.getItem(CFG_KEY);
  if(!raw){ throw new Error("Firebase config not found. Open admin-setup.html first."); }
  const cfg = JSON.parse(raw);
  if (cfg.storageBucket && !cfg.storageBucket.endsWith("appspot.com")){
    cfg.storageBucket = cfg.projectId + ".appspot.com";
  }
  return cfg;
}
const firebaseConfig = readConfig();
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const tableBody = document.querySelector("#userTable tbody");
const bannerTbody = document.querySelector("#bannerTable tbody");
const wdTbody = document.querySelector("#wdTable tbody");
const msg = document.querySelector("#msg");

function adminUIDs(){
  const s = (localStorage.getItem(ADMIN_KEY)||"").trim();
  return new Set(s ? s.split(",").map(x=>x.trim()).filter(Boolean) : []);
}
function toast(t){ msg.textContent=t; setTimeout(()=>msg.textContent="", 5000); }

onAuthStateChanged(auth, async (user) => {
  try{
    if(!user){
      if(confirm("Please sign in as admin to continue. Tap OK for Google sign-in.")){
        const prov=new GoogleAuthProvider(); await signInWithPopup(auth, prov);
      }else{ location.href="index.html"; }
      return;
    }
    const ids = adminUIDs();
    if(ids.has(user.uid)){ toast("Welcome admin (whitelist)."); autoLoad(); return; }
    const snap = await get(ref(db, "users/"+user.uid));
    const me = snap.exists()? snap.val(): {};
    const isAdmin = (String(me.role||'').toLowerCase()==='admin') && !!me.verified;
    if(!isAdmin){ alert("Access denied! Admin only."); location.href="index.html"; return; }
    toast("Welcome admin."); autoLoad();
  }catch(e){ console.error(e); alert("Could not verify admin."); location.href="index.html"; }
});

function autoLoad(){ loadUsers(); loadBanners(); loadWithdrawals(); }

async function loadUsers(){
  tableBody.innerHTML = "<tr><td colspan='7' class='muted'>Loading...</td></tr>";
  const s = await get(ref(db, "users"));
  if(!s.exists()){ tableBody.innerHTML="<tr><td colspan='7' class='muted'>No users</td></tr>"; return; }
  let html="";
  s.forEach(ch=>{
    const u=ch.val()||{};
    html += `<tr>
      <td>${u.name||'N/A'}</td><td>${u.email||''}</td>
      <td>${Number(u.balance||0).toFixed(2)}</td><td>${u.role||'user'}</td>
      <td>${u.verified?'✅':'❌'}</td><td>${ch.key}</td>
      <td><button class="btn-outline" onclick="window.makeAdmin('${ch.key}')">Make Admin</button></td>
    </tr>`;
  });
  tableBody.innerHTML = html;
}
window.makeAdmin = async (uid)=>{ await update(ref(db, "users/"+uid), { role:"admin" }); loadUsers(); };

async function addOrDeduct(isAdd){
  const uid=document.getElementById('uid').value.trim();
  const amount=Number(document.getElementById('amount').value);
  if(!uid || !amount || isNaN(amount)){ toast("Invalid input"); return; }
  const s=await get(ref(db, "users/"+uid)); if(!s.exists()){ toast("User not found"); return; }
  const newBal = Number(s.val().balance||0) + (isAdd?amount:-amount);
  await update(ref(db, "users/"+uid), { balance:newBal });
  toast("Balance updated $" + newBal.toFixed(2)); loadUsers();
}
document.getElementById('addBtn').onclick=()=>addOrDeduct(true);
document.getElementById('dedBtn').onclick=()=>addOrDeduct(false);

document.getElementById('verifyBtn').onclick=async()=>{
  const uid=document.getElementById('v_uid').value.trim(); if(!uid){toast("UID required");return;}
  await update(ref(db, "users/"+uid), { verified:true }); toast("User verified"); loadUsers();
};

async function loadBanners(){
  bannerTbody.innerHTML="<tr><td colspan='4' class='muted'>Loading...</td></tr>";
  const s=await get(ref(db,"banners"));
  if(!s.exists()){ bannerTbody.innerHTML="<tr><td colspan='4' class='muted'>No banners</td></tr>"; return; }
  let html="";
  s.forEach(ch=>{
    const b=ch.val()||{};
    const prev=b.img?`<img src="${b.img}" style="width:120px;height:60px;object-fit:cover;border-radius:8px">`:"";
    html+=`<tr>
      <td>${prev}</td><td>${b.link?`<a href="${b.link}" target="_blank">open</a>`:""}</td>
      <td>${b.active?'✅':'❌'}</td>
      <td>
        <button class="btn-outline" onclick="window.toggleBanner('${ch.key}', ${b.active?'false':'true'})">${b.active?'Deactivate':'Activate'}</button>
        <button class="btn-outline" onclick="window.delBanner('${ch.key}')">Delete</button>
      </td></tr>`;
  });
  bannerTbody.innerHTML=html;
}
document.getElementById('addBanner').onclick=async()=>{
  const img=document.getElementById('bn_img').value.trim();
  const link=document.getElementById('bn_link').value.trim();
  if(!img){ toast("Image URL required"); return; }
  const key=(await push(ref(db,'banners'))).key;
  await set(ref(db,'banners/'+key), { img, link, active:true, createdAt:Date.now() });
  toast("Banner added"); document.getElementById('bn_img').value=''; document.getElementById('bn_link').value=''; loadBanners();
};
window.toggleBanner=async(id,to)=>{ await update(ref(db,'banners/'+id), { active:!!to }); loadBanners(); };
window.delBanner=async(id)=>{ await set(ref(db,'banners/'+id), null); loadBanners(); };

async function loadWithdrawals(){
  wdTbody.innerHTML="<tr><td colspan='6' class='muted'>Loading...</td></tr>";
  const filter=document.getElementById('wdFilter').value;
  const s=await get(ref(db,'withdrawals'));
  if(!s.exists()){ wdTbody.innerHTML="<tr><td colspan='6' class='muted'>No requests</td></tr>"; return; }
  let html=""; s.forEach(ch=>{
    const w=ch.val()||{}; if(filter!=='all' && String(w.status||'pending')!==filter) return;
    html+=`<tr><td>${ch.key}</td><td>${w.uid||''}</td><td>${w.method||''}</td>
      <td>${Number(w.amount||0).toFixed(2)}</td><td>${w.status||'pending'}</td>
      <td><button class="btn-outline" onclick="window.setWd('${ch.key}','approved')">Approve</button>
          <button class="btn-outline" onclick="window.setWd('${ch.key}','rejected')">Reject</button></td></tr>`;
  });
  wdTbody.innerHTML=html || "<tr><td colspan='6' class='muted'>No matching</td></tr>";
}
document.getElementById('reloadWd').onclick=loadWithdrawals;
window.setWd=async(id,st)=>{ await update(ref(db,'withdrawals/'+id), { status:st }); loadWithdrawals(); };
document.getElementById('loadUsers').onclick=loadUsers;
