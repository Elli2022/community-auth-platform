const API = "";
const SESSION_KEY = "caf_session";
const AVATARS = 5;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let registerAvatarData = null;
let registerAvatarId = 1;
let composerImageData = null;
let activeChatUser = null;
let realtimeSource = null;
let realtimeFallbackTimer = null;
let threadRealtimeSource = null;

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  syncNav();
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  syncNav();
}

function authHeaders() {
  const t = getSession()?.token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function presetAvatar(id) {
  return `/avatars/${Math.min(AVATARS, Math.max(1, Number(id) || 1))}.svg`;
}

function avatarSrc(user) {
  if (!user) return presetAvatar(1);
  return user.avatar_url || (user.has_custom_avatar ? `/api/v1/users/${encodeURIComponent(user.username)}/avatar` : presetAvatar(user.avatar_id));
}

function displayName(u) {
  if (!u) return "";
  if (u.display_name) return u.display_name;
  if (u.name && u.surname) return `${u.name} ${u.surname}`;
  if (u.name) return u.name;
  return u.username;
}

function toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " error" : ""}`;
  el.textContent = msg;
  $("#toast-root").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders(), ...opts.headers },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.err === 1) throw new Error(body.message || `Fel ${res.status}`);
  return body;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size > 400_000) {
      reject(new Error("Bilden får max vara 400 KB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Kunde inte läsa bilden."));
    reader.readAsDataURL(file);
  });
}

function parseRoute() {
  const h = location.hash.slice(1) || "/";
  if (h === "/register") return { view: "register" };
  if (h === "/login") return { view: "auth", auth: "login" };
  if (h === "/forgot-password") return { view: "auth", auth: "forgot-password" };
  if (h === "/forgot-username") return { view: "auth", auth: "forgot-username" };
  const reset = h.match(/^\/reset-password/);
  if (reset) {
    const token = new URLSearchParams(location.hash.split("?")[1] || "").get("token");
    return { view: "auth", auth: "reset-password", token };
  }
  const prof = h.match(/^\/profile\/([^/]+)/);
  if (prof) return { view: "profile", username: decodeURIComponent(prof[1]) };
  const msg = h.match(/^\/messages\/?([^/]*)/);
  if (msg) return { view: "messages", username: msg[1] ? decodeURIComponent(msg[1]) : null };
  return { view: "home" };
}

function showAuthPanel(panel) {
  $("#auth-login-panel").hidden = panel !== "login";
  $("#auth-forgot-password-panel").hidden = panel !== "forgot-password";
  $("#auth-forgot-username-panel").hidden = panel !== "forgot-username";
  $("#auth-reset-password-panel").hidden = panel !== "reset-password";
}

function showView(route) {
  const isAuth = route.view === "auth";
  $("#view-home").hidden = route.view !== "home";
  $("#view-register").hidden = route.view !== "register";
  $("#view-profile").hidden = route.view !== "profile";
  $("#view-messages").hidden = route.view !== "messages";
  $("#view-auth").hidden = !isAuth;
  $("#notif-panel").hidden = true;
  document.body.classList.toggle("auth-page", isAuth || route.view === "register");
  if (route.view !== "messages") stopThreadRealtime();

  if (route.view === "home") {
    loadFeed();
    loadSidebar();
  } else if (route.view === "register") {
    initRegisterAvatars();
  } else if (route.view === "auth") {
    showAuthPanel(route.auth || "login");
    if (route.auth === "reset-password" && route.token) {
      $("#reset-token").value = route.token;
    }
  } else if (route.view === "profile") {
    loadProfile(route.username);
  } else if (route.view === "messages") {
    loadMessagesView(route.username);
  }
}

function switchProfileTab(tab) {
  $$(".profile-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  $("#tab-posts").hidden = tab !== "posts";
  $("#tab-about").hidden = tab !== "about";
  $("#tab-settings").hidden = tab !== "settings";
}

function syncNav() {
  const s = getSession();
  const logged = Boolean(s?.user);
  $("#session-box").hidden = !logged;
  $("#login-form").hidden = logged;
  $("#composer").hidden = !logged;
  $("#guest-banner").hidden = logged;
  $("#nav-register").hidden = logged;

  $("#notif-wrap").hidden = !logged;
  $("#nav-messages").hidden = !logged;
  $("#sidebar-messages").hidden = !logged;
  $("#nav-login-link").hidden = logged;
  if (!logged) stopRealtime();

  if (logged) {
    const u = s.user;
    const href = `#/profile/${encodeURIComponent(u.username)}`;
    $("#nav-me").href = href;
    $("#sidebar-profile").href = href;
    $("#sidebar-profile").hidden = false;
    $("#sidebar-messages").href = "#/messages";
    $("#nav-avatar").src = avatarSrc(u);
    $("#composer-avatar").src = avatarSrc(u);
    refreshBadges();
    startRealtime();
  }
}

async function refreshBadges() {
  if (!getSession()?.token) return;
  try {
    const { data } = await api("/api/v1/notifications");
    applyBadgeCounts({
      notifications_unread: data.unread_count,
      messages_unread: Number($("#msg-badge").textContent || 0),
    });
  } catch { /* ignore */ }
  try {
    const { data } = await api("/api/v1/messages");
    applyBadgeCounts({
      notifications_unread: Number($("#notif-badge").textContent || 0),
      messages_unread: data.unread_count,
    });
  } catch { /* ignore */ }
}

function applyBadgeCounts({ notifications_unread, messages_unread }) {
  const nb = $("#notif-badge");
  if (Number(notifications_unread) > 0) {
    nb.textContent = String(notifications_unread);
    nb.hidden = false;
  } else {
    nb.textContent = "";
    nb.hidden = true;
  }

  const mb = $("#msg-badge");
  if (Number(messages_unread) > 0) {
    mb.textContent = String(messages_unread);
    mb.hidden = false;
  } else {
    mb.textContent = "";
    mb.hidden = true;
  }
}

function stopRealtime() {
  if (realtimeSource) {
    realtimeSource.close();
    realtimeSource = null;
  }
  if (realtimeFallbackTimer) {
    clearInterval(realtimeFallbackTimer);
    realtimeFallbackTimer = null;
  }
}

function stopThreadRealtime() {
  if (threadRealtimeSource) {
    threadRealtimeSource.close();
    threadRealtimeSource = null;
  }
}

function startRealtime() {
  stopRealtime();
  const session = getSession();
  if (!session?.token) return;

  if (typeof EventSource === "function") {
    const source = new EventSource(
      `/api/v1/stream?token=${encodeURIComponent(session.token)}`
    );
    source.addEventListener("badges", (event) => {
      try {
        applyBadgeCounts(JSON.parse(event.data || "{}"));
      } catch {
        /* ignore malformed event */
      }
    });
    source.addEventListener("error", () => {
      source.close();
      realtimeSource = null;
      if (!realtimeFallbackTimer) {
        void refreshBadges();
        realtimeFallbackTimer = setInterval(() => {
          void refreshBadges();
        }, 15000);
      }
    });
    realtimeSource = source;
    return;
  }

  realtimeFallbackTimer = setInterval(() => {
    void refreshBadges();
  }, 15000);
}

function renderThreadMessages(messages) {
  const box = $("#thread-messages");
  const status = $("#thread-status");
  box.innerHTML = "";
  messages.forEach((m) => {
    const el = document.createElement("div");
    el.className = `bubble ${m.mine ? "mine" : "theirs"}`;
    el.textContent = m.body;
    box.appendChild(el);
  });
  box.scrollTop = box.scrollHeight;

  const mine = messages.filter((m) => m.mine);
  const lastMine = mine[mine.length - 1];
  if (lastMine) {
    status.hidden = false;
    status.textContent = lastMine.read
      ? `Sett${lastMine.read_at ? ` ${lastMine.read_at}` : ""}`
      : "Skickat";
  } else {
    status.hidden = true;
    status.textContent = "";
  }
}

function startThreadRealtime(username) {
  stopThreadRealtime();
  const session = getSession();
  if (!session?.token || typeof EventSource !== "function") return;
  const source = new EventSource(
    `/api/v1/stream?token=${encodeURIComponent(session.token)}&thread_with=${encodeURIComponent(username)}`
  );
  source.addEventListener("thread", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      if (payload.username === activeChatUser && Array.isArray(payload.messages)) {
        renderThreadMessages(payload.messages);
      }
    } catch {
      /* ignore malformed event */
    }
  });
  source.addEventListener("error", () => {
    source.close();
    threadRealtimeSource = null;
  });
  threadRealtimeSource = source;
}

async function checkHealth() {
  const dot = $("#health-dot");
  try {
    const r = await fetch(`${API}/health`);
    const d = await r.json();
    dot.className = d.status === "ok" ? "health-dot ok" : "health-dot err";
  } catch {
    dot.className = "health-dot err";
  }
}

function buildAvatarPicker(container, selected, onPick) {
  container.innerHTML = "";
  for (let i = 1; i <= AVATARS; i++) {
    const label = document.createElement("label");
    label.className = "avatar-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "av";
    input.value = String(i);
    input.checked = i === selected && !registerAvatarData;
    const img = document.createElement("img");
    img.src = presetAvatar(i);
    img.alt = `Avatar ${i}`;
    label.append(input, img);
    input.addEventListener("change", () => {
      registerAvatarData = null;
      onPick(i);
    });
    container.appendChild(label);
  }
}

function initRegisterAvatars() {
  buildAvatarPicker($("#register-avatars"), registerAvatarId, (id) => {
    registerAvatarId = id;
    $("#reg-avatar-id").value = String(id);
    $("#register-preview").src = presetAvatar(id);
  });
}

function renderSharedEmbed(sp) {
  if (!sp) return "";
  const a = sp.author || {};
  const img = sp.has_image ? `${API}${sp.image_url}` : "";
  return `
    <div class="shared-post">
      <header class="post-header">
        <img src="${avatarSrc(a)}" alt="" width="32" height="32" />
        <div><strong>${escapeHtml(displayName(a))}</strong></div>
      </header>
      ${sp.message?.trim() ? `<p class="post-body">${escapeHtml(sp.message.trim())}</p>` : ""}
      ${img ? `<img class="post-image" src="${img}" alt="" loading="lazy" />` : ""}
    </div>
  `;
}

function renderPostCard(post) {
  const card = document.createElement("article");
  card.className = "post-card card";
  card.dataset.postId = String(post.id);

  const author = post.author || {};
  const name = displayName(author);
  const img = post.has_image ? `${API}${post.image_url}` : "";
  const shared = post.shared_post ? `<p class="shared-label">↪ Delade ett inlägg</p>${renderSharedEmbed(post.shared_post)}` : "";

  const me = getSession()?.user?.username;
  const canDeletePost = Boolean(me && post.username === me);

  card.innerHTML = `
    <header class="post-header">
      <a href="#/profile/${encodeURIComponent(post.username)}">
        <img src="${avatarSrc(author)}" alt="" width="40" height="40" />
      </a>
      <div>
        <a href="#/profile/${encodeURIComponent(post.username)}"><strong>${escapeHtml(name)}</strong></a>
        <time>${escapeHtml(post.created)}</time>
      </div>
    </header>
    ${shared}
    ${post.message.trim() && post.message.trim() !== " " ? `<p class="post-body">${escapeHtml(post.message.trim())}</p>` : ""}
    ${img ? `<img class="post-image" src="${img}" alt="" loading="lazy" />` : ""}
    <div class="post-stats">
      <span class="likes-label">${post.likes_count || 0} gilla-markeringar</span>
      · <span class="comments-count">${post.comments_count || 0} kommentarer</span>
    </div>
    <div class="post-actions">
      <button type="button" class="btn-like ${post.liked_by_me ? "liked" : ""}">👍 Gilla</button>
      <button type="button" class="btn-comment-toggle">💬 Kommentera</button>
      <button type="button" class="btn-share">↗ Dela</button>
      ${canDeletePost ? '<button type="button" class="btn-delete-post">🗑 Radera</button>' : ""}
    </div>
    <div class="post-comments">${(post.comments || []).map((c) => renderComment(c, me)).join("")}</div>
    <form class="comment-form" hidden>
      <img src="${getSession() ? avatarSrc(getSession().user) : presetAvatar(1)}" alt="" width="32" height="32" />
      <input type="text" placeholder="Skriv en kommentar…" maxlength="300" />
      <button type="submit" class="btn btn-fb">Skicka</button>
    </form>
  `;

  card.querySelector(".btn-like")?.addEventListener("click", () => toggleLike(post.id, card));
  card.querySelector(".btn-comment-toggle")?.addEventListener("click", () => {
    card.querySelector(".comment-form").hidden = !card.querySelector(".comment-form").hidden;
  });
  card.querySelector(".comment-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = e.target.querySelector("input");
    addComment(post.id, input.value.trim(), card);
    input.value = "";
  });
  card.querySelector(".btn-share")?.addEventListener("click", () => sharePost(post.id));
  card.querySelector(".btn-delete-post")?.addEventListener("click", () => deletePost(post.id));

  return card;
}

async function sharePost(postId) {
  if (!getSession()) return toast("Logga in för att dela.", "error");
  const msg = prompt("Lägg till en kommentar (valfritt):") ?? "";
  if (msg === null) return;
  try {
    await api(`/api/v1/posts/${postId}/share`, {
      method: "POST",
      body: JSON.stringify({ message: msg }),
    });
    toast("Inlägg delat!");
    loadFeed();
    refreshBadges();
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderComment(c, me) {
  const canDelete = Boolean(me && c.username === me);
  const a = c.author || {};
  return `
    <div class="comment">
      <img src="${avatarSrc(a)}" alt="" />
      <div class="comment-bubble">
        <strong>${escapeHtml(a.display_name || c.username)}</strong>
        <span>${escapeHtml(c.message)}</span>
        ${canDelete ? `<button type="button" class="comment-delete" data-comment-id="${c.id}" title="Radera kommentar">Ta bort</button>` : ""}
      </div>
    </div>
  `;
}

async function deletePost(postId) {
  if (!getSession()) return toast("Logga in.", "error");
  if (!confirm("Radera detta inlägg permanent?")) return;
  try {
    await api(`/api/v1/posts/${postId}`, { method: "DELETE" });
    toast("Inlägg raderat.");
    await loadFeed();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteComment(commentId) {
  if (!getSession()) return toast("Logga in.", "error");
  try {
    await api(`/api/v1/comments/${commentId}`, { method: "DELETE" });
    await loadFeed();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadFeed() {
  const box = $("#feed-posts");
  const loading = $("#feed-loading");
  const empty = $("#feed-empty");
  loading.hidden = false;
  empty.hidden = true;
  box.innerHTML = "";

  try {
    const { data } = await api("/api/v1/feed");
    loading.hidden = true;
    if (!data?.length) {
      empty.hidden = false;
      return;
    }
    data.forEach((p) => box.appendChild(renderPostCard(p)));
  } catch (e) {
    loading.hidden = true;
    toast(e.message, "error");
  }
}

async function toggleLike(postId, card) {
  if (!getSession()) {
    toast("Logga in för att gilla.", "error");
    return;
  }
  try {
    const { data } = await api(`/api/v1/posts/${postId}/like`, { method: "POST" });
    const btn = card.querySelector(".btn-like");
    btn.classList.toggle("liked", data.liked);
    card.querySelector(".likes-label").textContent = `${data.likes_count} gilla-markeringar`;
  } catch (e) {
    toast(e.message, "error");
  }
}

async function addComment(postId, message, card) {
  if (!getSession()) return toast("Logga in.", "error");
  if (!message) return;
  try {
    const { data } = await api(`/api/v1/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    const box = card.querySelector(".post-comments");
    box.insertAdjacentHTML("beforeend", renderComment(data.comment));
    const n = card.querySelectorAll(".comment").length;
    card.querySelector(".comments-count").textContent = `${n} kommentarer`;
  } catch (e) {
    toast(e.message, "error");
  }
}

async function publishPost() {
  const s = getSession();
  if (!s) return toast("Logga in först.", "error");
  const text = $("#composer-text").value.trim();
  if (!text && !composerImageData) return toast("Skriv något eller lägg till en bild.", "error");

  try {
    await api("/api/v1/wall", {
      method: "POST",
      body: JSON.stringify({
        message: text || " ",
        ...(composerImageData ? { image_data: composerImageData } : {}),
      }),
    });
    $("#composer-text").value = "";
    composerImageData = null;
    $("#composer-preview").hidden = true;
    toast("Inlägg publicerat!");
    loadFeed();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadSidebar() {
  const friendsEl = $("#sidebar-friends");
  const contacts = $("#contacts-list");
  const suggestions = $("#suggestions-list");
  friendsEl.innerHTML = "";
  contacts.innerHTML = "";
  suggestions.innerHTML = "";

  const s = getSession();
  if (s?.token) {
    try {
      const { data } = await api("/api/v1/friends");
      if (data.pending_incoming?.length) {
        friendsEl.innerHTML = "<p><strong>Vänförfrågningar</strong></p>";
        data.pending_incoming.forEach((u) => {
          const row = document.createElement("div");
          row.className = "contact-row";
          row.innerHTML = `
            <img src="${u.avatar_url}" alt="" />
            <span>${escapeHtml(u.display_name)}</span>
            <button type="button" class="btn btn-fb btn-accept" data-u="${escapeHtml(u.username)}">Acceptera</button>
          `;
          row.querySelector(".btn-accept").addEventListener("click", () => acceptFriend(u.username));
          friendsEl.appendChild(row);
        });
      }
      data.friends?.forEach((u) => contacts.appendChild(contactRow(u, false)));
    } catch {
      /* ignore */
    }
  }

  try {
    const { data: members } = await api("/api/v1/");
    const me = s?.user?.username;
    const list = (members || []).filter((u) => u.username !== me).slice(0, 8);
    list.forEach((u) => suggestions.appendChild(contactRow(u, true)));
  } catch {
    /* ignore */
  }
}

async function sendFriendRequest(username) {
  if (!getSession()) return toast("Logga in.", "error");
  try {
    await api("/api/v1/friends/request", { method: "POST", body: JSON.stringify({ username }) });
    toast(`Vänförfrågan skickad till @${username}`);
    loadSidebar();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function acceptFriend(username) {
  try {
    await api("/api/v1/friends/accept", { method: "POST", body: JSON.stringify({ username }) });
    toast(`Du och @${username} är nu vänner!`);
    loadSidebar();
    loadFeed();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadProfile(username) {
  const cover = $("#profile-cover");
  const avatar = $("#profile-avatar");
  const posts = $("#profile-posts");
  posts.innerHTML = "<p class='muted'>Laddar…</p>";

  try {
    const { data } = await api(`/api/v1/users/${encodeURIComponent(username)}`);
    cover.style.background = `linear-gradient(135deg, ${data.cover_color || "#1877f2"}, #6a5acd)`;
    avatar.src = avatarSrc(data);
    $("#profile-name").textContent = displayName(data);
    $("#profile-handle").textContent = `@${data.username}`;
    const bioText = data.bio || "Ingen presentation ännu.";
    $("#profile-bio").textContent = bioText;
    $("#profile-about-text").textContent = bioText;

    const actions = $("#profile-actions");
    actions.innerHTML = "";
    const s = getSession();

    if (data.isOwner) {
      $("#tab-btn-settings").hidden = false;
      $("#profile-upload-label").hidden = false;
      switchProfileTab("posts");
      $("#edit-bio").value = data.bio || "";
      $("#edit-name").value = data.name || "";
      $("#edit-surname").value = data.surname || "";
      $("#edit-cover").value = data.cover_color || "#1877f2";
      buildAvatarPicker($("#edit-avatars"), data.avatar_id, (id) => {
        registerAvatarId = id;
      });
    } else {
      $("#tab-btn-settings").hidden = true;
      $("#profile-upload-label").hidden = true;
      switchProfileTab("posts");
      if (s?.user && data.friend_status === "none") {
        const b = document.createElement("button");
        b.className = "btn btn-fb";
        b.textContent = "+ Lägg till vän";
        b.onclick = () => sendFriendRequest(username);
        actions.appendChild(b);
      } else if (data.friend_status === "pending_incoming") {
        const b = document.createElement("button");
        b.className = "btn btn-fb";
        b.textContent = "Acceptera vänförfrågan";
        b.onclick = () => acceptFriend(username);
        actions.appendChild(b);
      } else if (data.friend_status === "friends") {
        actions.innerHTML = '<span class="muted">✓ Vänner</span>';
        const chatBtn = document.createElement("button");
        chatBtn.className = "btn btn-secondary";
        chatBtn.textContent = "💬 Skicka meddelande";
        chatBtn.onclick = () => {
          location.hash = `#/messages/${encodeURIComponent(username)}`;
        };
        actions.appendChild(chatBtn);
      } else if (data.friend_status === "pending_outgoing") {
        actions.innerHTML = '<span class="muted">Förfrågan skickad</span>';
      }
    }

    posts.innerHTML = "";
    if (!data.posts?.length) {
      posts.innerHTML = "<p class='muted'>Inga inlägg ännu.</p>";
    } else {
      data.posts.forEach((p) => posts.appendChild(renderPostCard(p)));
    }
  } catch (e) {
    posts.innerHTML = `<p class='muted'>${escapeHtml(e.message)}</p>`;
  }
}

async function saveProfile(username) {
  const payload = {
    bio: $("#edit-bio").value.trim(),
    name: $("#edit-name").value.trim() || undefined,
    surname: $("#edit-surname").value.trim() || undefined,
    cover_color: $("#edit-cover").value,
  };
  if (registerAvatarData) {
    payload.avatar_image = registerAvatarData;
  } else {
    payload.use_preset_avatar = true;
    payload.avatar_id = registerAvatarId;
  }
  try {
    const { data } = await api(`/api/v1/users/${encodeURIComponent(username)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const s = getSession();
    if (s) setSession({ ...s, user: data });
    toast("Profil sparad!");
    loadProfile(username);
    syncNav();
  } catch (e) {
    toast(e.message, "error");
  }
}

$$(".profile-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchProfileTab(btn.dataset.tab));
});

$("#login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const { data } = await api("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: String(fd.get("username") || "").trim().toLowerCase(),
        password: fd.get("password"),
      }),
    });
    setSession(data);
    e.target.reset();
    toast(`Välkommen, ${displayName(data.user)}!`);
    location.hash = "#/";
  } catch (err) {
    toast(translateApiError(err.message), "error");
  }
});

$("#forgot-password-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = new FormData(e.target).get("email");
  const resultEl = $("#forgot-password-result");
  try {
    const { data } = await api("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    resultEl.hidden = false;
    let html = `<p>${escapeHtml(data.message)}</p>`;
    if (data.dev_reset_url) {
      html += `<p><strong>Återställningslänk:</strong><br><a href="${escapeHtml(data.dev_reset_url)}">${escapeHtml(data.dev_reset_url)}</a></p>`;
    }
    resultEl.innerHTML = html;
  } catch (err) {
    toast(translateApiError(err.message), "error");
  }
});

$("#forgot-username-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = new FormData(e.target).get("email");
  const resultEl = $("#forgot-username-result");
  try {
    const { data } = await api("/api/v1/auth/forgot-username", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    resultEl.hidden = false;
    let html = `<p>${escapeHtml(data.message)}</p>`;
    if (data.dev_username) {
      html += `<p><strong>Ditt användarnamn:</strong> @${escapeHtml(data.dev_username)}</p>`;
    }
    resultEl.innerHTML = html;
  } catch (err) {
    toast(translateApiError(err.message), "error");
  }
});

$("#reset-password-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  if (fd.get("password") !== fd.get("password2")) {
    return toast("Lösenorden matchar inte.", "error");
  }
  try {
    const { data } = await api("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token: fd.get("token") || $("#reset-token").value,
        password: fd.get("password"),
      }),
    });
    toast(data.message);
    location.hash = "#/login";
  } catch (err) {
    toast(translateApiError(err.message), "error");
  }
});

$("#btn-logout")?.addEventListener("click", () => {
  clearSession();
  toast("Utloggad");
  location.hash = "#/";
});

$("#btn-publish")?.addEventListener("click", publishPost);

$("#composer-image")?.addEventListener("change", async (e) => {
  try {
    composerImageData = await readFileAsDataUrl(e.target.files[0]);
    $("#composer-preview-img").src = composerImageData;
    $("#composer-preview").hidden = false;
  } catch (err) {
    toast(err.message, "error");
  }
});

$("#composer-clear-img")?.addEventListener("click", () => {
  composerImageData = null;
  $("#composer-preview").hidden = true;
  $("#composer-image").value = "";
});

function validateUsername(value) {
  const v = (value || "").trim();
  if (!v) return "Användarnamn krävs.";
  if (v.includes("@") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return "Användarnamn kan inte vara en e-postadress. Använd fältet ”E-post” nedan.";
  }
  if (v.length <= 4 || v.length >= 25) return "Användarnamn måste vara 5–24 tecken.";
  if (!/^[a-z][a-z0-9]+$/i.test(v)) {
    return "Endast bokstäver (A–Z/a–z) och siffror, och måste börja med en bokstav.";
  }
  return "";
}

function translateApiError(msg) {
  if (!msg) return "Något gick fel.";
  if (msg.includes("Invalid string for username")) {
    return "Ogiltigt användarnamn. Använd 5–24 tecken med små bokstäver och siffror — inte e-post.";
  }
  if (msg.includes("email already registered")) return "E-postadressen är redan registrerad.";
  if (msg.includes("user already exists")) return "Användarnamnet finns redan.";
  if (msg.includes("Provided email is invalid") || msg.includes("Ogiltig e-post")) {
    return "Ogiltig e-postadress.";
  }
  if (msg.startsWith("Needed parameter missing") || msg.startsWith("Saknad uppgift")) {
    return "Fyll i alla obligatoriska fält.";
  }
  return msg;
}

$("#register-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const usernameRaw = fd.get("username")?.trim() || "";
  const usernameErr = validateUsername(usernameRaw);
  const userInput = e.target.elements.username;
  if (usernameErr) {
    $("#register-error").textContent = usernameErr;
    userInput?.classList.add("invalid");
    return toast(usernameErr, "error");
  }
  userInput?.classList.remove("invalid");

  const payload = {
    username: usernameRaw.toLowerCase(),
    password: fd.get("password"),
    bio: fd.get("bio")?.trim() || undefined,
    email: fd.get("email")?.trim() || undefined,
    name: fd.get("name")?.trim() || undefined,
    surname: fd.get("surname")?.trim() || undefined,
  };
  if (registerAvatarData) payload.avatar_image = registerAvatarData;
  else payload.avatar_id = registerAvatarId;

  $("#register-error").textContent = "";
  try {
    const { data } = await api("/api/v1/", { method: "POST", body: JSON.stringify(payload) });
    toast(`Konto @${data.username} skapat! Logga in.`);
    location.hash = "#/";
    e.target.reset();
    registerAvatarData = null;
    registerAvatarId = 1;
  } catch (err) {
    const msg = translateApiError(err.message);
    $("#register-error").textContent = msg;
    toast(msg, "error");
  }
});

$("#register-form")?.elements.username?.addEventListener("input", (e) => {
  const err = validateUsername(e.target.value);
  e.target.classList.toggle("invalid", Boolean(err));
  if (!err) $("#register-error").textContent = "";
});

$("#register-upload")?.addEventListener("change", async (e) => {
  try {
    registerAvatarData = await readFileAsDataUrl(e.target.files[0]);
    $("#register-preview").src = registerAvatarData;
    $$("#register-avatars input").forEach((i) => (i.checked = false));
  } catch (err) {
    toast(err.message, "error");
  }
});

$("#profile-upload")?.addEventListener("change", async (e) => {
  const u = getSession()?.user?.username;
  if (!u) return;
  try {
    const image = await readFileAsDataUrl(e.target.files[0]);
    const { data } = await api(`/api/v1/users/${encodeURIComponent(u)}`, {
      method: "PATCH",
      body: JSON.stringify({ avatar_image: image }),
    });
    const s = getSession();
    if (s) setSession({ ...s, user: data });
    toast("Profilbild uppdaterad!");
    syncNav();
    loadProfile(u);
  } catch (err) {
    toast(err.message, "error");
  }
});

$("#edit-upload")?.addEventListener("change", async (e) => {
  try {
    registerAvatarData = await readFileAsDataUrl(e.target.files[0]);
    $("#profile-avatar").src = registerAvatarData;
  } catch (err) {
    toast(err.message, "error");
  }
});

$("#btn-save-profile")?.addEventListener("click", () => {
  const u = getSession()?.user?.username;
  if (u) saveProfile(u);
});

$("#btn-delete-profile")?.addEventListener("click", async () => {
  const u = getSession()?.user?.username;
  const pw = $("#delete-password").value;
  if (!u || !pw) return toast("Ange lösenord.", "error");
  if (!confirm("Radera kontot permanent?")) return;
  try {
    await api(`/api/v1/users/${encodeURIComponent(u)}`, {
      method: "DELETE",
      body: JSON.stringify({ password: pw }),
    });
    clearSession();
    toast("Kontot är raderat.");
    location.hash = "#/";
    loadFeed();
  } catch (e) {
    toast(e.message, "error");
  }
});

$("#member-search")?.addEventListener("input", async (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (q.length < 2) return;
  try {
    const { data } = await api("/api/v1/");
    const hit = (data || []).find((u) => u.username.includes(q) || displayName(u).toLowerCase().includes(q));
    if (hit) location.hash = `#/profile/${encodeURIComponent(hit.username)}`;
  } catch {
    /* ignore */
  }
});

async function loadNotificationsPanel() {
  const panel = $("#notif-panel");
  if (!getSession()) return;
  try {
    const { data } = await api("/api/v1/notifications");
    panel.innerHTML = data.items.length
      ? data.items
          .map(
            (n) => `
        <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}" data-type="${n.type}" data-actor="${escapeHtml(n.actor.username)}">
          <img src="${n.actor.avatar_url}" alt="" />
          <div>
            <p>${escapeHtml(n.text)}</p>
            ${n.preview ? `<p class="muted">${escapeHtml(n.preview)}</p>` : ""}
            <time>${escapeHtml(n.created)}</time>
          </div>
        </div>`
          )
          .join("")
      : '<p class="muted" style="padding:1rem">Inga notiser</p>';

    panel.querySelectorAll(".notif-item").forEach((el) => {
      el.addEventListener("click", async () => {
        const id = Number(el.dataset.id);
        const type = el.dataset.type;
        const actor = el.dataset.actor;
        await api("/api/v1/notifications/read", {
          method: "PATCH",
          body: JSON.stringify({ id }),
        });
        panel.hidden = true;
        refreshBadges();
        if (type === "message") location.hash = `#/messages/${encodeURIComponent(actor)}`;
        else if (type === "friend_request") location.hash = `#/profile/${encodeURIComponent(getSession().user.username)}`;
        else location.hash = "#/";
        loadFeed();
      });
    });
  } catch (e) {
    panel.innerHTML = `<p class="muted" style="padding:1rem">${escapeHtml(e.message)}</p>`;
  }
}

$("#btn-notifications")?.addEventListener("click", async (e) => {
  e.stopPropagation();
  const panel = $("#notif-panel");
  if (panel.hidden) {
    await loadNotificationsPanel();
    panel.hidden = false;
    await api("/api/v1/notifications/read", { method: "PATCH", body: "{}" });
    refreshBadges();
  } else panel.hidden = true;
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".notif-wrap")) $("#notif-panel").hidden = true;
  const btn = e.target.closest(".comment-delete");
  if (btn) {
    const id = Number(btn.dataset.commentId);
    if (Number.isInteger(id) && id > 0) deleteComment(id);
  }
});

async function loadMessagesView(openUser) {
  const list = $("#conversations-list");
  list.innerHTML = "<p class='muted'>Laddar…</p>";
  if (!getSession()) {
    location.hash = "#/";
    return toast("Logga in för meddelanden.", "error");
  }
  try {
    const { data } = await api("/api/v1/messages");
    list.innerHTML = "";
    if (!data.conversations?.length) {
      list.innerHTML = "<p class='muted'>Inga konversationer. Bli vän med någon först!</p>";
    } else {
      data.conversations.forEach((c) => {
        const a = document.createElement("a");
        a.href = `#/messages/${encodeURIComponent(c.username)}`;
        a.className = `conv-row${openUser === c.username ? " active" : ""}`;
        a.innerHTML = `
          <img src="${c.avatar_url}" alt="" />
          <div class="conv-meta">
            <strong>${escapeHtml(c.display_name)}</strong>
            <span class="conv-preview">${escapeHtml(c.last_message || "")}</span>
          </div>
          ${c.unread ? `<span class="conv-unread">${c.unread}</span>` : ""}
        `;
        list.appendChild(a);
      });
    }
    refreshBadges();
    if (openUser) await openChat(openUser);
    else {
      activeChatUser = null;
      stopThreadRealtime();
      $("#thread-header").textContent = "Välj en konversation";
      $("#thread-messages").innerHTML = "";
      $("#thread-status").hidden = true;
      $("#thread-status").textContent = "";
      $("#thread-form").hidden = true;
    }
  } catch (e) {
    list.innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`;
  }
}

async function openChat(username) {
  activeChatUser = username;
  $("#thread-form").hidden = false;
  $("#thread-header").textContent = `@${username}`;
  const box = $("#thread-messages");
  box.innerHTML = "<p class='muted'>Laddar…</p>";
  try {
    const { data } = await api(`/api/v1/messages/${encodeURIComponent(username)}`);
    renderThreadMessages(data);
    startThreadRealtime(username);
    refreshBadges();
  } catch (e) {
    box.innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`;
  }
}

$("#thread-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeChatUser) return;
  const body = $("#thread-input").value.trim();
  if (!body) return;
  try {
    await api(`/api/v1/messages/${encodeURIComponent(activeChatUser)}`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    $("#thread-input").value = "";
    await openChat(activeChatUser);
    refreshBadges();
  } catch (err) {
    toast(err.message, "error");
  }
});

function contactRow(u, showAdd) {
  const row = document.createElement("div");
  row.className = "contact-row";
  row.innerHTML = `
    <a href="#/profile/${encodeURIComponent(u.username)}">
      <img src="${avatarSrc(u)}" alt="" />
    </a>
    <a href="#/profile/${encodeURIComponent(u.username)}">${escapeHtml(displayName(u))}</a>
    ${showAdd ? `<button type="button" class="btn btn-secondary btn-add">+ Vän</button>` : `<button type="button" class="btn btn-secondary btn-chat">💬</button>`}
  `;
  row.querySelector(".btn-add")?.addEventListener("click", () => sendFriendRequest(u.username));
  row.querySelector(".btn-chat")?.addEventListener("click", () => {
    location.hash = `#/messages/${encodeURIComponent(u.username)}`;
  });
  return row;
}

window.addEventListener("hashchange", () => showView(parseRoute()));

syncNav();
checkHealth();
showView(parseRoute());
setInterval(() => { if (getSession()) refreshBadges(); }, 60000);
