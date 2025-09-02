import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = "8041168610:AAFHg7avPTcONzAoik-sQ5AlsqsRJc5D6cA";
const ADMIN_ID = "5568760903";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(bodyParser.json());

// Храним состояния пользователей
const userStates = {};

// Обработка команды /start
bot.start((ctx) => {
  ctx.reply("Добро пожаловать! Используйте кнопку Menu ниже 👇", 
    Markup.keyboard([["📋 Menu"]]).resize()
  );
});

// Нажатие кнопки Menu
bot.hears("📋 Menu", (ctx) => {
  ctx.reply("Откройте меню через мини-приложение", 
    Markup.keyboard([Markup.button.webApp("Открыть меню", process.env.WEBAPP_URL || "https://food-bot-mini.onrender.com")]).resize()
  );
});

// Получение данных из mini-app
bot.on("message", async (ctx) => {
  if (ctx.message.web_app_data) {
    try {
      const data = JSON.parse(ctx.message.web_app_data.data);
      userStates[ctx.chat.id] = { step: "pavilion", order: data };
      await ctx.reply("Введите номер павильона:");
    } catch (err) {
      console.error("Ошибка JSON.parse:", err.message);
      ctx.reply("Ошибка обработки заказа ❌");
    }
  } else if (userStates[ctx.chat.id]) {
    const state = userStates[ctx.chat.id];
    if (state.step === "pavilion") {
      state.pavilion = ctx.message.text;
      state.step = "phone";
      await ctx.reply("Введите номер телефона:");
    } else if (state.step === "phone") {
      state.phone = ctx.message.text;
      const orderText = state.order.items.map(i => `${i.name} x${i.quantity}`).join("\n");
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `📦 Новый заказ!\nПавильон: ${state.pavilion}\nТелефон: ${state.phone}\nЗаказ:\n${orderText}`
      );
      await ctx.reply("✅ Заказ отправлен администратору!");
      delete userStates[ctx.chat.id];
    }
  }
});

// Express сервер для webhook
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

app.get("/", (req, res) => {
  res.send("Bot server is running...");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Сервер запущен на порту ${PORT}`);
});
