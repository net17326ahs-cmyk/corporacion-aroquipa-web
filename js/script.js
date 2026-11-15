const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:3000/api"
  : "https://corporacion-aroquipa-web.onrender.com/api";

const menuBtn = document.getElementById("menuBtn");
const navMenu = document.getElementById("navMenu");

menuBtn.addEventListener("click", () => navMenu.classList.toggle("open"));
document.querySelectorAll("#navMenu a").forEach(a => {
  a.addEventListener("click", () => navMenu.classList.remove("open"));
});

const form = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMessage.textContent = "Enviando solicitud...";
  formMessage.className = "form-message";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch(`${API_URL}/contactos`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.mensaje || "No se pudo enviar.");

    form.reset();
    formMessage.textContent = "¡Solicitud enviada correctamente!";
    formMessage.className = "form-message success";
  } catch (error) {
    formMessage.textContent = "No se pudo conectar con el servidor. Verifica que el backend esté iniciado.";
    formMessage.className = "form-message error";
  }
});

// ===== CHATBOT =====
(function () {
  const chatbot      = document.getElementById("chatbot");
  const chatToggle   = document.getElementById("chatToggle");
  const chatClose    = document.getElementById("chatClose");
  const chatWindow   = document.getElementById("chatWindow");
  const chatMessages = document.getElementById("chatMessages");
  const chatTyping   = document.getElementById("chatTyping");
  const chatForm     = document.getElementById("chatForm");
  const chatInput    = document.getElementById("chatInput");

  // Historial de conversación enviado a Claude en cada turno
  const history = [];

  function toggleChat(open) {
    const isOpen = open !== undefined ? open : chatWindow.hidden;
    chatWindow.hidden = !isOpen;
    chatbot.classList.toggle("open", isOpen);
    if (isOpen) chatInput.focus();
  }

  chatToggle.addEventListener("click", () => toggleChat());
  chatClose.addEventListener("click",  () => toggleChat(false));

  function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = "chat-msg " + (role === "user" ? "user" : "bot");
    div.innerHTML = "<span>" + text.replace(/</g, "&lt;").replace(/\n/g, "<br>") + "</span>";
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function setTyping(visible) {
    chatTyping.hidden = !visible;
    if (visible) chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";
    chatInput.disabled = true;

    addMessage("user", text);
    history.push({ role: "user", content: text });

    setTyping(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await res.json();

      setTyping(false);

      if (!res.ok) throw new Error(data.mensaje || "Error del servidor.");

      addMessage("bot", data.reply);
      history.push({ role: "assistant", content: data.reply });

    } catch (err) {
      setTyping(false);
      addMessage("bot", "Lo siento, no pude conectarme en este momento. Por favor intenta más tarde.");
      console.error("Chat error:", err);
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  });
})();
