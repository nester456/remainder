require("dotenv").config();
const { Client } = require("whatsapp-web.js");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");
const fs = require("fs");

//////////////////////////////////////////////////
// 🔐 ENV VARIABLES (Railway)
//////////////////////////////////////////////////

const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const stringSession = new StringSession(process.env.TG_STRING_SESSION || "");

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_REMINDER_CHANNEL = "-1003719282039";

//////////////////////////////////////////////////
// 📍 ЛОКАЦІЇ
//////////////////////////////////////////////////

const locations = {
  "Дніпровський район": {
    groupName: "DRC Dnipro Team",
    groupId: "120363023446341119@g.us",
    lastLevel: "green",
    timer: null
  },
  "м. Харків та Харківська територіальна громада": {
    groupName: "DRC Kharkiv Team",
    groupId: "120363029286365519@g.us",
    lastLevel: "green",
    timer: null
  },
  "Херсонський район": {
    groupName: "DRC Kherson",
    groupId: "120363279744372436@g.us",
    lastLevel: "green",
    timer: null
  },
  "м. Київ": {
    groupName: "Kyiv Country Office",
    groupId: "120363022703522334@g.us",
    lastLevel: "green",
    timer: null
  },
  "Миколаївський район": {
    groupName: "DRC Mykolaiv",
    groupId: "120363062976584533@g.us",
    lastLevel: "green",
    timer: null
  },
  "Шосткинський район": {
    groupName: "Shostka Alerts",
    groupId: "120363280813470075@g.us",
    lastLevel: "green",
    timer: null
  },
  "Краматорський район": {
    groupName: "Slovyansk Alerts",
    groupId: "120363221232729996@g.us",
    lastLevel: "green",
    timer: null
  },
  "Сумський район": {
    groupName: "DRC Sumy Area Office",
    groupId: "120363121851681827@g.us",
    lastLevel: "green",
    timer: null
  },
  "м. Запоріжжя та Запорізька територіальна громада": {
    groupName: "Alerts in Zaporizka",
    groupId: "120363166224916518@g.us",
    lastLevel: "green",
    timer: null
  }
};

//////////////////////////////////////////////////
// 📲 TELEGRAM REMINDER
//////////////////////////////////////////////////

async function sendReminder(text) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_REMINDER_CHANNEL,
        text
      }
    );
  } catch (err) {
    console.error("Reminder error:", err.message);
  }
}

//////////////////////////////////////////////////
// 🟢 WHATSAPP CLIENT
//////////////////////////////////////////////////

const waClient = new Client({
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

const qrcode = require("qrcode-terminal");

waClient.on("qr", qr => {
  console.log("=== WHATSAPP QR CODE ===");
  qrcode.generate(qr, { small: true });
});

waClient.on("ready", () => {
  console.log("WhatsApp Ready");
});

waClient.on("message", msg => {
  const loc = Object.values(locations).find(
    l => l.groupId === msg.from
  );

  if (!loc) return;
  if (msg.fromMe) return; // тільки працівник

  if (msg.body.includes("Рівень Синій")) {
    loc.lastLevel = "blue";
    console.log("Blue set in", loc.groupName);
  }

  if (msg.body.includes("Рівень Зелений")) {
    loc.lastLevel = "green";
    console.log("Green set in", loc.groupName);
  }
});

waClient.initialize();

//////////////////////////////////////////////////
// 📡 TELEGRAM CLIENT (air_alert_ua)
//////////////////////////////////////////////////

(async () => {
  const tgClient = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5
  });

  await tgClient.start({
    phoneNumber: async () => process.env.TG_PHONE,
    password: async () => process.env.TG_PASSWORD,
    phoneCode: async () =>
      await new Promise(resolve => {
        process.stdin.once("data", data => resolve(data.toString().trim()));
      }),
    onError: err => console.log(err)
  });

  console.log("Telegram Client Ready");

  tgClient.addEventHandler(async event => {
    const text = event.message.message;
    if (!text) return;

    //////////////////////////////////////////////////
    // 🔷 BLUE CHECK
    //////////////////////////////////////////////////
    if (text.includes("Повітряна тривога в:")) {

      Object.keys(locations).forEach(location => {

        if (text.includes(location)) {

          const loc = locations[location];

          if (loc.lastLevel === "green") {

            if (loc.timer) clearTimeout(loc.timer);

            loc.timer = setTimeout(() => {

              if (loc.lastLevel !== "blue") {
                sendReminder(
                  `Увага, ви забули поставити синій рівень тривоги в ${loc.groupName}`
                );
              }

            }, 120000);
          }
        }
      });
    }

    //////////////////////////////////////////////////
    // 🟢 GREEN CHECK
    //////////////////////////////////////////////////
    if (text.includes("Відбій тривоги в:")) {

      Object.keys(locations).forEach(location => {

        if (text.includes(location)) {

          const loc = locations[location];

          if (loc.timer) clearTimeout(loc.timer);

          loc.timer = setTimeout(() => {

            if (loc.lastLevel !== "green") {
              sendReminder(
                `Увага, ви забули поставити зелений рівень тривоги в ${loc.groupName}`
              );
            }

          }, 120000);
        }
      });
    }

  }, new NewMessage({}));

})();
