// admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {"apiKey": "AIzaSyCid8oZ2fNng0k6j3qIbRRl0Qww3Yz5Tvk", "authDomain": "rf-video-8cdd3.firebaseapp.com", "databaseURL": "https://rf-video-8cdd3-default-rtdb.firebaseio.com", "projectId": "rf-video-8cdd3", "storageBucket": "rf-video-8cdd3.firebasestorage.app", "messagingSenderId": "537761009773", "appId": "1:537761009773:web:902551a17dc10ea93b6f64", "measurementId": "G-ZYCJM6K9HS"};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
const auth = getAuth(app);

const tableBody = document.querySelector("#userTable tbody");
const bannerTbody = document.querySelector("#bannerTable tbody");
const wdTbody = document.querySelector("#wdTable tbody");

// ---- ADMIN GATE ----
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login as admin!");
    location.href = "index.html";
    return;
  }
  const snap = await get(ref(db, "users/" + user.uid));
  const me = snap.val();
  if (!me || String(me.role||"").toLowerCase() !== "admin") {
    alert("Access denied! Admin only.");
    location.href = "index.html";
    return;
  }
  // Auto-load sections
  loadUsers();
  loadBanners();
  loadWithdrawals();
});

// ---- USERS LIST ----
window.loadUsers = async function () {
  tableBody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
  const allSnap = await get(ref(db, "users"));
  if (!allSnap.exists()) {
    tableBody.innerHTML = "<tr><td colspan='6'>No users found</td></tr>";
    return;
  }
  let html = "";
  allSnap.forEach(ch => {
    const u = ch.val() || {};
    html += `<tr>
      <td>${u.name || "N/A"}</td>
      <td>${u.email || ""}</td>
      <td>$${Number(u.balance || 0).toFixed(2)}</td>
      <td>${u.role || "user"}</td>
      <td>${u.verified ? "✅" : "❌"}</td>
      <td><button class='btn-outline' onclick='makeAdmin("${u.uid}")'>Make Admin</button></td>
    </tr>`;
  });
  tableBody.innerHTML = html;
};

window.addBalance = async function () {
  const uid = document.getElementById("uid").value.trim();
  const amount = Number(document.getElementById("amount").value);
  const msg = document.getElementById("msg");
  msg.textContent = "";
  if (!uid || amount <= 0) return msg.textContent = "Invalid input";

  const snap = await get(ref(db, "users/" + uid));
  if (!snap.exists()) return msg.textContent = "User not found";
  const u = snap.val();
  const newBal = (Number(u.balance) || 0) + amount;
  await update(ref(db, "users/" + uid), { balance: newBal });
  msg.textContent = `Balance updated: $${newBal.toFixed(2)}`;
  loadUsers();
};

window.deductBalance = async function () {
  const uid = document.getElementById("uid").value.trim();
  const amount = Number(document.getElementById("amount").value);
  const msg = document.getElementById("msg");
  msg.textContent = "";
  if (!uid || amount <= 0) return msg.textContent = "Invalid input";

  const snap = await get(ref(db, "users/" + uid));
  if (!snap.exists()) return msg.textContent = "User not found";
  const u = snap.val();
  const newBal = Math.max(0, (Number(u.balance) || 0) - amount);
  await update(ref(db, "users/" + uid), { balance: newBal });
  msg.textContent = `Balance updated: $${newBal.toFixed(2)}`;
  loadUsers();
};

window.verifyUser = async function () {
  const uid = document.getElementById("v_uid").value.trim();
  if (!uid) return alert("Enter UID");
  await update(ref(db, "users/" + uid), { verified: true });
  alert("User verified!");
  loadUsers();
};

window.makeAdmin = async function (uid) {
  if (!confirm("Make this user admin?")) return;
  await update(ref(db, "users/" + uid), { role: "admin" });
  alert("User is now admin");
  loadUsers();
};

// ---- BANNERS ----
async function loadBanners() {
  if (!bannerTbody) return;
  bannerTbody.innerHTML = "<tr><td colspan='4'>Loading…</td></tr>";
  const snap = await get(ref(db, "banners"));
  if (!snap.exists()) { bannerTbody.innerHTML = "<tr><td colspan='4'>No banners</td></tr>"; return; }
  const data = snap.val() || {};
  const rows = Object.entries(data).reverse().map(([id, b]) => {
    const img = b.img || "";
    const link = b.link || "";
    const active = b.active ? "✅" : "❌";
    return `<tr>
      <td><img src="${img}" alt="" style="width:160px;height:60px;object-fit:cover;border-radius:8px"/></td>
      <td>${link ? `<a href="${link}" target="_blank">${link}</a>` : "-"}</td>
      <td>${active}</td>
      <td>
        <button class="btn-outline" onclick='toggleBanner("${id}", ${b.active ? "false" : "true"})'>
          ${b.active ? "Disable" : "Enable"}
        </button>
        <button class="btn-outline" onclick='deleteBanner("${id}")'>Delete</button>
      </td>
    </tr>`;
  }).join("");
  bannerTbody.innerHTML = rows || "<tr><td colspan='4'>No banners</td></tr>";
}

window.addBanner = async function () {
  const img = document.getElementById("bn_img").value.trim();
  const link = document.getElementById("bn_link").value.trim();
  if (!img) { alert("Image URL দিন"); return; }
  const id = "bn_" + Date.now();
  await update(ref(db, "banners/" + id), {
    img, link: link || "", active: true, createdAt: Date.now()
  });
  document.getElementById("bn_img").value = "";
  document.getElementById("bn_link").value = "";
  loadBanners();
};

window.toggleBanner = async function (id, makeActive) {
  await update(ref(db, "banners/" + id), { active: !!makeActive });
  loadBanners();
};

window.deleteBanner = async function (id) {
  if (!confirm("Delete this banner?")) return;
  await update(ref(db), { ["banners/" + id]: null });
  loadBanners();
};

// ---- WITHDRAWALS ----
window.loadWithdrawals = async function () {
  if (!wdTbody) return;
  wdTbody.innerHTML = "<tr><td colspan='6'>Loading…</td></tr>";
  const snap = await get(ref(db, "withdrawals"));
  const filter = (document.getElementById("wd_filter")?.value || "all").toLowerCase();
  if (!snap.exists()) { wdTbody.innerHTML = "<tr><td colspan='6'>No withdrawals</td></tr>"; return; }

  const entries = Object.entries(snap.val() || {}).sort((a,b)=> b[0].localeCompare(a[0]));
  const rows = entries
    .filter(([id, w]) => filter === "all" ? true : (String(w.status||"pending").toLowerCase() === filter))
    .map(([id, w]) => {
      const amt = Number(w.amount||0).toFixed(2);
      const st = (w.status||"pending");
      return `<tr>
        <td>${id}</td>
        <td>${w.uid}</td>
        <td>${w.method||"-"}</td>
        <td>$${amt}</td>
        <td>${st}</td>
        <td>
          <button class="btn-outline" onclick='approveWithdraw("${id}")'>Approve</button>
          <button class="btn-outline" onclick='rejectWithdraw("${id}")'>Reject</button>
        </td>
      </tr>`;
    }).join("");
  wdTbody.innerHTML = rows || "<tr><td colspan='6'>No data</td></tr>";
};

window.approveWithdraw = async function (id) {
  await update(ref(db, "withdrawals/" + id), { status: "approved", reviewedAt: Date.now() });
  loadWithdrawals();
};

window.rejectWithdraw = async function (id) {
  await update(ref(db, "withdrawals/" + id), { status: "rejected", reviewedAt: Date.now() });
  loadWithdrawals();
};
