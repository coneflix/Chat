toggleBtn = document.getElementById('toggleBtn');
SideMenu = document.getElementById('SideMenu');

toggleBtn.addEventListener('click', () => {
    SideMenu.classList.toggle('active');
});

/* ===== JS extra que estava inline no index.html ===== */
/* ====== FIREBASE CONFIG ====== */
const firebaseConfig = {
    apiKey: "AIzaSyBILycC5yJWzYnw4V7EOKfSXYy0AhcESKE",
    authDomain: "visitas-folha-de-iuiu.firebaseapp.com",
    projectId: "visitas-folha-de-iuiu",
    storageBucket: "visitas-folha-de-iuiu.appspot.com",
    messagingSenderId: "481698502397",
    appId: "1:481698502397:web:44f291a43eb34762721094",
    measurementId: "G-7CSR6JXJQR"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ====== VARS / ELEMENTS ====== */
let currentUser = null;
let previewPhoto = "images/img-04.jpg";

const modal = document.getElementById("profileModal");
const closeModal = document.getElementById("closeModal");
const closeProfile = document.getElementById("closeProfile");
const saveProfile = document.getElementById("saveProfile");
const usernameInput = document.getElementById("usernameInput");
const photoInput = document.getElementById("photoInput");
const logoutBtn = document.getElementById("logoutBtn");
const notif = document.getElementById("notif");
const typingBubble = document.getElementById("typingBubble");
const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// Master Modal & Login
const masterModal = document.getElementById("masterModal");
const masterLoginModal = document.getElementById("masterLoginModal");
const masterBtn = document.getElementById("masterBtn");
const closeMaster = document.getElementById("closeMaster");
const closeMasterLogin = document.getElementById("closeMasterLogin");
const masterLoginBtn = document.getElementById("masterLoginBtn");
const masterUserList = document.getElementById("masterUserList");
const masterMsgList = document.getElementById("masterMsgList");

const endSessionsBtn = document.getElementById("endSessionsBtn");
const deleteAllMsgsBtn = document.getElementById("deleteAllMsgsBtn");
const masterLogoutBtn = document.getElementById("masterLogoutBtn");

// Usuário master fixo
const MASTER_USERNAME = "masterAdmin";
const MASTER_PASSWORD = "Secure123!";

/* ====== UTIL: resize/crop image to square (200x200) ====== */
function resizeImageToSquare(file, size, callback){
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = size;
      canvas.height = size;
      // center-crop to square
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      callback(canvas.toDataURL('image/png'));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ====== STARTUP ====== */
window.addEventListener("load", () => {
  // load user from localStorage (persist across tabs)
  const savedUser = JSON.parse(localStorage.getItem("chatUser") || "{}");
  if (!savedUser.name) {
    modal.classList.add("show");
  } else {
    currentUser = savedUser;
    setUserUI(currentUser);
    setUserOnline(currentUser).catch(()=>{});
    // welcome toast
    showNotif(`Bem-vindo de volta, ${currentUser.name}!`);
  }

  // If master already logged in (session), open master panel
  if (sessionStorage.getItem("isMaster") === "true") {
    masterModal.classList.add("show");
    loadMasterData();
  }

  listenMessages();
  cleanupOldData();
});

/* Keep login in sync across tabs */
window.addEventListener("storage", (e) => {
  if (e.key === "chatUser") {
    const newVal = JSON.parse(e.newValue || "{}");
    if (newVal.name) {
      currentUser = newVal;
      setUserUI(currentUser);
      setUserOnline(currentUser).catch(()=>{});
      showNotif(`Bem-vindo de volta, ${currentUser.name}!`);
    } else {
      currentUser = null;
      document.getElementById("navUserImg").src = "images/img-04.jpg";
      document.getElementById("chatUserImg").src = "images/img-01.jpg";
      document.getElementById("chatUserName").textContent = "Ava Davis";
    }
  }
});

/* ====== PHOTO INPUT ====== */
photoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    resizeImageToSquare(file, 200, (resizedDataUrl) => {
      previewPhoto = resizedDataUrl;
      document.getElementById("previewPhoto").src = previewPhoto;
    });
  }
});

/* ====== PROFILE MODAL CONTROLS ====== */
closeModal.onclick = closeProfile.onclick = () => { modal.classList.remove("show"); };

saveProfile.onclick = async () => {
  const username = usernameInput.value.trim();
  if (!username) { alert("Digite seu nome!"); return; }
  currentUser = { id: Date.now().toString(), name: username, photo: previewPhoto, online: true, createdAt: Date.now() };
  localStorage.setItem("chatUser", JSON.stringify(currentUser));
  setUserUI(currentUser);
  try { await setUserOnline(currentUser); } catch(e){}
  modal.classList.remove("show");
};

function setUserUI(user){
  document.getElementById("navUserImg").src = user.photo;
  document.getElementById("chatUserImg").src = user.photo;
  document.getElementById("chatUserName").textContent = user.name;
}

async function setUserOnline(user){
  await db.collection("users").doc(user.id).set({ ...user, online: true });
}

/* ====== Logout ====== */
logoutBtn.addEventListener("click", async () => {
  if(currentUser){
    try {
      await db.collection("users").doc(currentUser.id).delete();
    } catch(e){}
    currentUser = null;
    localStorage.removeItem("chatUser");
    sessionStorage.removeItem("isMaster");
    location.reload();
  }
});

/* ====== SEND MESSAGE ====== */
sendBtn.addEventListener("click", async () => {
  if(!currentUser){ modal.classList.add("show"); return; }
  if(!messageInput.value.trim()) return;
  await db.collection("messages").add({
    user: currentUser.name,
    photo: currentUser.photo,
    text: messageInput.value.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    userId: currentUser.id
  });
  messageInput.value = "";
  setTyping(false);
});

/* ====== Typing indicator ====== */
messageInput.addEventListener("input", () => {
  setTyping(messageInput.value.length > 0);
});
function setTyping(status){
  typingBubble.style.display = status ? "block" : "none";
  if(status){
    const avatar = document.getElementById("chatUserImg");
    if (avatar) {
      const rect = avatar.getBoundingClientRect();
      typingBubble.style.left = rect.left + "px";
      typingBubble.style.top = rect.bottom + 6 + "px";
    }
  }
}

/* ====== Helpers ====== */
function getMsgTimeMs(createdAt){
  if(!createdAt) return 0;
  if (createdAt.toMillis) return createdAt.toMillis();
  if (createdAt.getTime) return createdAt.getTime();
  return Number(createdAt) || 0;
}

/* ====== Listen messages ====== */
function listenMessages() {
  db.collection("messages").orderBy("createdAt").onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const m = change.doc.data();
        if (currentUser && m.user !== currentUser.name) {
          showNotif("Nova mensagem de " + m.user);
        }
      }
    });

    chatBox.innerHTML = "";
    snapshot.forEach(doc => {
      const msg = doc.data();
      const div = document.createElement("div");
      div.className = "chat-box";
      div.id = "msg-" + doc.id;
      if(msg.user === currentUser?.name) div.classList.add("my-message");

      const photo = msg.photo || "images/img-01.jpg";
      const userNameEsc = (msg.user || "User").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const textSafe = (msg.text || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const timeMs = getMsgTimeMs(msg.createdAt);

      div.innerHTML = `<img src="${photo}" alt=""/><div class="chat-txt"><h4>${userNameEsc} <span class="msg-time"></span></h4><p>${textSafe}</p></div>`;

      if (currentUser && msg.userId === currentUser.id) {
        const now = Date.now();
        const age = timeMs ? (now - timeMs) : 0;
        if (age <= 2 * 60 * 1000) {
          const del = document.createElement("span");
          del.textContent = "Apagar";
          del.className = "delete-btn";
          del.onclick = () => db.collection("messages").doc(doc.id).delete();
          div.querySelector(".chat-txt").appendChild(del);
        }
      }

      const timeSpan = div.querySelector(".msg-time");
      if (timeMs && timeSpan) {
        const d = new Date(timeMs);
        timeSpan.textContent = "* " + d.toLocaleTimeString();
      }

      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

/* ====== Users list ====== */
db.collection("users").onSnapshot(snapshot => {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";
  snapshot.forEach(doc => {
    const user = doc.data();
    const div = document.createElement("div");
    div.className = "chat";
    const statusColor = user.online ? "online" : "offline";
    div.innerHTML = `<img src="${user.photo}" alt=""/><p>${user.name} <span class="user-status ${statusColor}"></span></p>`;
    userList.appendChild(div);
  });
});

/* ====== MASTER PANEL ====== */
masterBtn.addEventListener("click", () => {
  if (sessionStorage.getItem("isMaster") === "true") {
    masterModal.classList.add("show");
    loadMasterData();
  } else {
    masterLoginModal.classList.add("show");
  }
});

masterLoginBtn.addEventListener("click", () => {
  const user = document.getElementById("masterUser").value.trim();
  const pass = document.getElementById("masterPass").value.trim();
  if(user === MASTER_USERNAME && pass === MASTER_PASSWORD){
    masterLoginModal.classList.remove("show");
    masterModal.classList.add("show");
    sessionStorage.setItem("isMaster", "true");
    loadMasterData();
  } else {
    alert("Usuário ou senha incorretos!");
  }
});

closeMaster.onclick = () => masterModal.classList.remove("show");
closeMasterLogin.onclick = () => masterLoginModal.classList.remove("show");

function loadMasterData(){
  masterUserList.innerHTML = "";
  masterMsgList.innerHTML = "";

  db.collection("users").onSnapshot(snapshot => {
    masterUserList.innerHTML = "";
    snapshot.forEach(doc => {
      const u = doc.data();
      const div = document.createElement("div");
      div.className = "user-item";
      div.innerHTML = `<span>${u.name}</span><button onclick="deleteUser('${doc.id}')">Apagar</button>`;
      masterUserList.appendChild(div);
    });
  });

  db.collection("messages").orderBy("createdAt").onSnapshot(snapshot => {
    masterMsgList.innerHTML = "";
    snapshot.forEach(doc => {
      const m = doc.data();
      const div = document.createElement("div");
      div.className = "msg-item";
      const textSafe = (m.text || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      div.innerHTML = `<span>${m.user}: ${textSafe}</span><button onclick="deleteMessage('${doc.id}')">Apagar</button>`;
      masterMsgList.appendChild(div);
    });
  });
}

async function deleteUser(id){
  try { await db.collection("users").doc(id).delete(); }
  catch(e){ console.error("deleteUser error", e); }
}

async function deleteMessage(id){
  try { await db.collection("messages").doc(id).delete(); }
  catch(e){ console.error("deleteMessage error", e); }
}

endSessionsBtn.addEventListener("click", async () => {
  if(!confirm("Encerrar TODAS as sessões?")) return;
  try {
    const snap = await db.collection("users").get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("Todas as sessões foram encerradas.");
  } catch(e){
    console.error("endSessions error", e);
    alert("Erro ao encerrar sessões.");
  }
});

deleteAllMsgsBtn.addEventListener("click", async () => {
  if(!confirm("Apagar TODAS as mensagens?")) return;
  try {
    const snap = await db.collection("messages").get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("Todas as mensagens foram apagadas.");
  } catch(e){
    console.error("deleteAllMsgs error", e);
    alert("Erro ao apagar mensagens.");
  }
});

masterLogoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("isMaster");
  masterModal.classList.remove("show");
  alert("Logout master efetuado.");
});

window.deleteUser = deleteUser;
window.deleteMessage = deleteMessage;

/* ===== Emoji Picker (lazy load) ===== */
const emojis = [
  "😀","😁","😂","🤣","😃","😅","😎","😍","😘","🥰","😜","🤩","😢","😭","😡","😱",
  "👍","🙏","👏","🙌","💖","🔥","🎉","✨","🌸","🍕","⚽","🎮"
];
let emojisLoaded = false;

function initEmojis() {
  emojis.forEach(e => {
    const span = document.createElement("span");
    span.textContent = e;
    span.onclick = () => {
      messageInput.value += e;
      emojiPicker.style.display = "none";
      messageInput.focus();
    };
    emojiPicker.appendChild(span);
  });
  emojisLoaded = true;
}

emojiBtn.addEventListener("click", () => {
  if (!emojisLoaded) {
    initEmojis();
  }
  emojiPicker.style.display = emojiPicker.style.display === "grid" ? "none" : "grid";
});

/* ===== Notificação ===== */
let notifTimer = null;
function showNotif(text){
  notif.textContent = text;
  notif.classList.add("show");
  if(notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(()=>{ notif.classList.remove("show"); }, 2500);
}

/* ===== Cleanup ===== */
function cleanupOldData(){
  const threeHoursAgo = Date.now() - 3*60*60*1000;
  db.collection("messages").where("createdAt", "<", new Date(threeHoursAgo)).get().then(snapshot => {
    snapshot.forEach(doc => doc.ref.delete());
  }).catch(()=>{});
  db.collection("users").where("createdAt", "<", threeHoursAgo).get().then(snapshot => {
    snapshot.forEach(doc => doc.ref.delete());
  }).catch(()=>{});
}
