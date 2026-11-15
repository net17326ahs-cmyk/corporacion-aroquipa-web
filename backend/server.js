const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "mensajes.json");

// API Key de Gemini (definir en la variable de entorno GEMINI_API_KEY)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) console.warn("Falta la variable de entorno GEMINI_API_KEY: el chatbot no funcionará.");
const GEMINI_MODEL  = "gemini-flash-latest";

const SYSTEM_PROMPT = `Eres el asistente virtual de Corporación Aroquipa S.A.C., una empresa peruana que brinda servicios tecnológicos: desarrollo de software, implementación de sistemas y comercialización de soluciones digitales. Responde siempre en español, de forma profesional, amable y concisa. Ayuda a los visitantes con dudas sobre los servicios, procesos de trabajo y cómo contactar a la empresa. Si alguien quiere contratar un servicio o necesita más información, invítalos a completar el formulario de contacto en la sección "Contáctanos" de la web. No inventes precios ni datos específicos que no conozcas.`;

function callGemini(messages, callback) {
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const bodyStr = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
  });

  const bodyBuf = Buffer.from(bodyStr, "utf8");

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": bodyBuf.length
    }
  };

  const req = https.request(options, (res) => {
    let data = "";
    res.on("data", chunk => data += chunk);
    res.on("end", () => {
      try {
        console.log("Gemini raw response:", data.slice(0, 300));
        const parsed = JSON.parse(data);
        if (parsed.error) return callback(new Error(parsed.error.message), null);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar una respuesta.";
        callback(null, text);
      } catch (e) {
        callback(e, null);
      }
    });
  });

  req.on("error", (e) => {
    console.error("Error de red Gemini:", e.message);
    callback(e, null);
  });
  req.write(bodyBuf);
  req.end();
}

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function readMessages() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveMessages(messages) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), "utf8");
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return sendJSON(res, 204, {});

  if (req.url === "/api/saludo" && req.method === "GET") {
    return sendJSON(res, 200, {
      mensaje: "API de Corporación Aroquipa funcionando correctamente."
    });
  }

  if (req.url === "/api/contactos" && req.method === "GET") {
    return sendJSON(res, 200, readMessages());
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const { messages } = JSON.parse(body);
        if (!Array.isArray(messages) || messages.length === 0) {
          return sendJSON(res, 400, { mensaje: "Se requiere un arreglo de mensajes." });
        }
        callGemini(messages, (err, reply) => {
          if (err) {
            console.error("Error Gemini API:", err.message);
            return sendJSON(res, 500, { mensaje: "Error al contactar con el asistente." });
          }
          sendJSON(res, 200, { reply });
        });
      } catch {
        sendJSON(res, 400, { mensaje: "Datos inválidos." });
      }
    });
    return;
  }

  if (req.url === "/api/contactos" && req.method === "POST") {
    let body = "";

    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const { nombre, correo, empresa = "", servicio, mensaje } = data;

        if (!nombre || !correo || !servicio || !mensaje) {
          return sendJSON(res, 400, {
            mensaje: "Completa los campos obligatorios."
          });
        }

        const messages = readMessages();
        const nuevo = {
          id: Date.now(),
          nombre,
          correo,
          empresa,
          servicio,
          mensaje,
          fecha: new Date().toISOString()
        };

        messages.push(nuevo);
        saveMessages(messages);

        sendJSON(res, 201, {
          mensaje: "Solicitud registrada correctamente.",
          contacto: nuevo
        });
      } catch {
        sendJSON(res, 400, { mensaje: "Los datos enviados no son válidos." });
      }
    });
    return;
  }

  sendJSON(res, 404, { mensaje: "Ruta no encontrada." });
});

server.listen(PORT, () => {
  console.log(`Servidor backend ejecutándose en http://localhost:${PORT}`);
});
