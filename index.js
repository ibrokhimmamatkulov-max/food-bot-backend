import express from "express";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const bot = new Telegraf("8041168610:AAFHg7avPTcONzAoik-sQ5AlsqsRJc5D6cA");
const ADMIN_ID = 5568760903;

// Тестовый webhook
app.post("/webhook", async (req, res) => {
  console.log("📩 Получены данные из mini-app:", req.body);
  try {
    const order = req.body;
    if (!order) throw new Error("Пустой заказ");
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `🛒 Новый заказ: ${JSON.stringify(order, null, 2)}`
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Ошибка обработки заказа:", err.message);
    res.status(500).json({ error: err.message });
  }
});

bot.start((ctx) => {
  ctx.reply("Добро пожаловать! Нажмите кнопку 'Menu', чтобы сделать заказ.", {
    reply_markup: {
      keyboard: [[{ text: "Menu", web_app: { url: "https://food-bot-mini.onrender.com" } }]],
      resize_keyboard: true
    }
  });
});

// webhook запуск
app.listen(3000, () => {
  console.log("🌐 Сервер запущен на порту 3000");
});
