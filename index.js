console.log("FORCE REDEPLOY 2026-02-13 QR-FIX");

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const QRCode = require("qrcode");
const FormData = require("form-data");

const { Client } = require("whatsapp-web.js");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

//////////////////////////////////////////////////
// 🔐 ENV
//////////////////////////////////////////////////

const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const stringSession = new StringSession(process.env.TG_STRING_SESSION);

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_REMINDER_CHANNEL = "-1003719282039";

//////////////////////////////////////////////////
// 📍 LOCATIONS
//////////////////////////////////////////////////

const locations = {
  "Дніпровський район": { groupName: "DRC Dnipro Team", groupId: "120363023446341119@g.us", lastLevel: "green", timer: null },
  "м. Харків та Харківська територіальна громада": { groupName: "DRC Kharkiv Team", groupId: "120363029286365519@g.us", lastLevel: "green", timer: null },
  "Херсонський район": { groupName: "DRC Kherson", groupId: "120363279744372436@g.us", lastLevel: "green", timer: null },
  "м. Київ": { groupName: "Kyiv Country Office", groupId: "120363022703522334@g.us", lastLevel: "green", timer: null },
  "Миколаївський район": { groupName: "DRC Mykolaiv", groupId: "120363062976584533@g.us", lastLevel: "green", timer: null },
  "Шосткинський район": { groupName: "Shostka Alerts", groupId: "120363280813470075@g.us", lastLevel: "green", timer: null },
  "Краматорський район": { groupName: "Slovyansk Alerts", groupId: "120363221232729996@g.us", lastLevel: "green", timer: null },
  "Сумський район": { groupName: "DRC Sumy Area Office", groupId: "120363121851681827@g.us", lastLevel: "green", timer: null },
  "м. Запоріжжя та Запорізька територіальна громада": { groupName: "Alerts in Zaporizka", groupId: "120363166224916518@g.us", lastLevel: "green", timer: null }
};

//////////////////////////////////////////////////
// 📲 TELEGRAM REMINDER
//////////////////////////////////////////////////

async function sendReminder(text) {
  await axios.post(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    { chat_id: TELEGRAM_REMINDER_CHANNEL, text }
  );
}

//////////////////////////////////////////////////
// 🟢 WHATSAPP CLIENT
//////////////////////////////////////////////////

const waClient = new Client({
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

waClient.on("qr", async qr => {
  const qrPath = path.join(__dirname, "whatsapp-qr.png");

  await QRCode.toFile(qrPath, qr, { width: 400 });

  const form = new FormData();
  form.append("chat_id", TELEGRAM_REMINDER_CHANNEL);
  form.append("photo", fs.createReadStream(qrPath));
  form.append("caption", "📲 Підключення WhatsApp\nВідскануйте QR у WhatsApp → Повʼязані пристрої");

  await axios.post(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
    form,
    { headers: form.getHeaders() }
  );

  console.log("WhatsApp QR sent to Telegram");
});

waClient.on("ready", () => console.log("WhatsApp Ready"));

waClient.on("message", msg => {
  const loc = Object.values(locations).find(l => l.groupId === msg.from);
  if (!loc || msg.fromMe) return;

  if (msg.body.includes("Рівень Синій")) loc.lastLevel = "blue";
  if (msg.body.includes("Рівень Зелений")) loc.lastLevel = "green";
});

waClient.initialize();

//////////////////////////////////////////////////
// 📡 TELEGRAM CLIENT
//////////////////////////////////////////////////

(async () => {
  const tgClient = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
  await tgClient.start({});
  console.log("Telegram Client Ready");

  tgClient.addEventHandler(async event => {
    const text = event.message.message;
    if (!text) return;

    if (text.includes("Повітряна тривога в:")) {
      Object.keys(locations).forEach(locName => {
        if (text.includes(locName)) {
          const loc = locations[locName];
          if (loc.lastLevel === "green") {
            setTimeout(() => {
              if (loc.lastLevel !== "blue") {
                sendReminder(`Увага, ви забули поставити синій рівень тривоги в ${loc.groupName}`);
              }
            }, 120000);
          }
        }
      });
    }

    if (text.includes("Відбій тривоги в:")) {
      Object.keys(locations).forEach(locName => {
        if (text.includes(locName)) {
          const loc = locations[locName];
          setTimeout(() => {
            if (loc.lastLevel !== "green") {
              sendReminder(`Увага, ви забули поставити зелений рівень тривоги в ${loc.groupName}`);
            }
          }, 120000);
        }
      });
    }
  }, new NewMessage({}));
})();
