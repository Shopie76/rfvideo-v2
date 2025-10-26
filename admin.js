// admin.js — Firebase Admin Panel (Realtime Database)
// Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, child, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ----- CONFIG LOADING -----
function loadFirebaseConfig() {
  // Prefer inline config (if window.FIREBASE_CONFIG is defined) else localStorage
  if (window.FIREBASE_CONFIG) return window.FIREBASE_CONFIG;
  const saved = localStorage.getItem('fbConfig');
  if (!saved) {
    alert('Firebase config not found. Open admin-setup.html first.');
    throw new Error('No firebase config');
  }
  return JSON.parse(saved);
}
const firebaseConfig = loadFirebaseConfig();

// Admin allow-list (your UID)
const ADMIN_UIDS = new Set(["hnZ0J84S5NT3J3y7Mr0Tnp7BvT53"]);

// ----- INIT -----
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
const auth = getAuth(app);
document.getElementById('adminUid').textContent = "Admin UID allow: hnZ0J84S5NT3J3y7Mr0Tnp7BvT53";

// Shortcuts to DOM
const userTable   = document.getElementById('userTable');
const bannerTable = document.getElementById('bannerTable');
const wdTable     = document.getElementById('wdTable');
const msg = (s) => document.getElementById('msg').textContent = s ?? '';

// ----- AUTH GATE -----
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // quick Google sign-in
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch(e) {
      alert('Please login as admin!'); location.href = "index.html"; return;
    }
    return;
  }
  try {
    // allow if in set, or if DB says admin+verified
    if (ADMIN_UIDS.has(user.uid)) { afterLogin(); return; }
    const snap = await get(ref(db, 'users/' + user.uid));
    const me = snap.val() || {};
    if ((me.role || '').toLowerCase() === 'admin' && !!me.verified) { afterLogin(); return; }
    alert('Access denied! Admin only.'); location.href = "index.html";
  } catch(err) {
    console.error(err); alert('Could not verify admin.'); location.href = "index.html";
  }
});

async function afterLogin() {
  await loadUsers();
  await loadBanners();
  await loadWithdrawals();
}

// ===== USERS =====
export async function loadUsers() {
  userTable.innerHTML = '<tr><td class="muted" colspan="6">Loading…</td></tr>';
  const all = await get(ref(db, 'users'));
  const data = all.val() || {};
  let html = '';
  Object.entries(data).forEach(([uid, u]) => {
    html += `<tr>
      <td>${u.name || 'N/A'}</td>
      <td>${u.email || ''}</td>
      <td>${Number(u.balance||0).toFixed(2)}</td>
      <td>${u.role||'user'}</td>
      <td>${u.verified ? '✅' : '❌'}</td>
      <td>
        <button class="btn" onclick="window.makeAdmin('${uid}')">Make Admin</button>
        <button class="btn btn-good" onclick="window.markVerified('${uid}')">Verify</button>
      </td>
    </tr>`;
  });
  userTable.innerHTML = html || '<tr><td class="muted" colspan="6">No users found.</td></tr>';
}
window.loadUsers = loadUsers;

window.makeAdmin = async function(uid) {
  await update(ref(db, 'users/' + uid), { role: 'admin' });
  await loadUsers();
};
window.markVerified = async function(uid) {
  await update(ref(db, 'users/' + uid), { verified: true });
  await loadUsers();
};

window.addBalance = async function() {
  const uid = document.getElementById('uid').value.trim();
  const amount = Number(document.getElementById('amount').value);
  if (!uid || !amount) return msg('Invalid input');
  await runTransaction(ref(db, 'users/' + uid + '/balance'), (v) => Number(v||0) + amount);
  msg('Balance added.');
  await loadUsers();
};
window.deductBalance = async function() {
  const uid = document.getElementById('uid2').value.trim();
  const amount = Number(document.getElementById('amount2').value);
  if (!uid || !amount) return msg('Invalid input');
  await runTransaction(ref(db, 'users/' + uid + '/balance'), (v) => Math.max(0, Number(v||0) - amount));
  msg('Balance deducted.');
  await loadUsers();
};
window.verifyUser = async function() {
  const uid = document.getElementById('vuid').value.trim();
  if (!uid) return msg('Enter UID');
  await update(ref(db, 'users/' + uid), { verified: true });
  msg('User verified.');
  await loadUsers();
};

// ===== BANNERS =====
export async function loadBanners() {
  bannerTable.innerHTML = '<tr><td class="muted" colspan="4">Loading…</td></tr>';
  const snap = await get(ref(db, 'banners'));
  const data = snap.val() || {};
  let html = '';
  Object.entries(data).forEach(([id, b]) => {
    html += `<tr>
      <td><img src="${b.img||''}" alt="" style="height:40px;border-radius:6px"/></td>
      <td><a class="link" href="${b.link||'#'}" target="_blank">${b.link||''}</a></td>
      <td>${b.active ? '✅' : '❌'}</td>
      <td>
        <button class="btn" onclick="window.toggleBanner('${id}', ${!b.active})">${b.active?'Disable':'Enable'}</button>
        <button class="btn btn-danger" onclick="window.delBanner('${id}')">Delete</button>
      </td>
    </tr>`;
  });
  bannerTable.innerHTML = html || '<tr><td class="muted" colspan="4">No banners.</td></tr>';
}
window.loadBanners = loadBanners;

window.addBanner = async function() {
  const img = document.getElementById('bannerUrl').value.trim();
  const link = document.getElementById('bannerLink').value.trim();
  if (!img) return alert('Enter image URL');
  const id = 'b_' + crypto.randomUUID().slice(0,8);
  await set(ref(db, 'banners/' + id), { img, link, active:true, createdAt: Date.now() });
  await loadBanners();
};
window.toggleBanner = async function(id, val) {
  await update(ref(db, 'banners/' + id), { active: !!val });
  await loadBanners();
};
window.delBanner = async function(id) {
  await set(ref(db, 'banners/' + id), null);
  await loadBanners();
};

// ===== WITHDRAWALS =====
export async function loadWithdrawals() {
  wdTable.innerHTML = '<tr><td class="muted" colspan="6">Loading…</td></tr>';
  const snap = await get(ref(db, 'withdrawals'));
  const data = snap.val() || {};
  let html = '';
  Object.entries(data).reverse().forEach(([id, w]) => {
    html += `<tr>
      <td>${id}</td>
      <td>${w.uid||''}</td>
      <td>${w.method||''}</td>
      <td>${Number(w.amount||0).toFixed(2)}</td>
      <td>${w.status||'pending'}</td>
      <td>
        <button class="btn btn-good" onclick="window.setWdStatus('${id}','paid')">Mark Paid</button>
        <button class="btn btn-danger" onclick="window.setWdStatus('${id}','rejected')">Reject</button>
      </td>
    </tr>`;
  });
  wdTable.innerHTML = html || '<tr><td class="muted" colspan="6">No withdrawals.</td></tr>';
}
window.loadWithdrawals = loadWithdrawals;

window.setWdStatus = async function(id, status) {
  await update(ref(db, 'withdrawals/' + id), { status });
  await loadWithdrawals();
};
