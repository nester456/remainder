require('dotenv').config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;

(async () => {
  const stringSession = new StringSession("");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Введи номер телефону: "),
    password: async () => await input.text("2FA пароль (якщо є): "),
    phoneCode: async () => await input.text("Код з Telegram: "),
    onError: (err) => console.log(err),
  });

  console.log("\nОсь твій TG_STRING_SESSION:\n");
  console.log(client.session.save());

  process.exit(0);
})();
