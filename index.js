import express from "express";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const APP_URL = process.env.APP_URL;

if (!BOT_TOKEN || !ADMIN_ID || !APP_URL) {
  console.error("❌ Missing BOT_TOKEN, ADMIN_ID or APP_URL in .env");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// webhook endpoint
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res).catch(err => console.error("❌ Bot error:", err));
});

bot.start((ctx) => {
  ctx.reply("👋 Привет! Используй кнопку Menu для заказа.");
});

// обработка данных из mini-app
bot.on("message", async (ctx) => {
  if (ctx.message?.web_app_data?.data) {
    try {
      const order = JSON.parse(ctx.message.web_app_data.data);
      console.log("📩 Order received:", order);

      await ctx.reply("✅ Заказ получен! Укажите номер павильона:");
      ctx.session = { order };  // сохраним заказ
    } catch (e) {
      console.error("❌ JSON parse error:", e.message);
      await ctx.reply("Ошибка обработки заказа 😔");
    }
  } else if (ctx.session?.order && !ctx.session.phone) {
    ctx.session.pavilion = ctx.message.text;
    await ctx.reply("📞 Укажите номер телефона:");
  } else if (ctx.session?.order && ctx.session.pavilion && !ctx.session.phone) {
    ctx.session.phone = ctx.message.text;

    // Отправляем админу
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `🍽 Новый заказ:
${JSON.stringify(ctx.session.order, null, 2)}
🏢 Павильон: ${ctx.session.pavilion}
📞 Телефон: ${ctx.session.phone}`
    );

    await ctx.reply("Спасибо! Ваш заказ передан администратору ✅");
    ctx.session = null;
  }
});

// запускаем сервер
app.listen(3000, async () => {
  console.log("🌐 Сервер запущен на порту 3000");

  try {
    await bot.telegram.setWebhook(`${APP_URL}/bot${BOT_TOKEN}`);
    console.log("✅ Webhook установлен:", `${APP_URL}/bot${BOT_TOKEN}`);
  } catch (err) {
    console.error("❌ Ошибка установки webhook:", err);
  }
});
