import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || "8041168610:AAFHg7avPTcONzAoik-sQ5AlsqsRJc5D6cA";
const ADMIN_ID = process.env.ADMIN_ID || "5568760903";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(bodyParser.json());

const userStates = {};

// Обработка команды /start
bot.start((ctx) => {
  ctx.reply("Добро пожаловать! Используйте кнопку Menu ниже 👇", 
    Markup.keyboard([["📋 Menu"]]).resize()
  );
});

// Нажатие кнопки Menu
bot.hears("📋 Menu", (ctx) => {
  const webAppUrl = process.env.WEBAPP_URL || "https://food-bot-mini.onrender.com";
  ctx.reply("Откройте меню через мини-приложение", 
    Markup.keyboard([Markup.button.webApp("Открыть меню", webAppUrl)]).resize()
  );
});

// Обработка ВСЕХ сообщений - ОДИН обработчик!
bot.on("message", async (ctx) => {
  // 1. Если это данные из WebApp
  if (ctx.message.web_app_data) {
    try {
      console.log("Данные из WebApp:", ctx.message.web_app_data.data);
      
      if (!ctx.message.web_app_data.data) {
        throw new Error("No data received");
      }

      const data = JSON.parse(ctx.message.web_app_data.data);
      
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error("Invalid order format");
      }

      // Сохраняем состояние и сразу просим павильон
      userStates[ctx.chat.id] = { 
        step: "pavilion", 
        order: data,
        createdAt: new Date()
      };
      
      await ctx.reply("Введите номер павильона:");
      return; // Важно: выходим после обработки
      
    } catch (err) {
      console.error("Ошибка обработки заказа:", err.message);
      await ctx.reply("Ошибка обработки заказа ❌\nПопробуйте еще раз.");
      return;
    }
  }

  // 2. Если у пользователя есть состояние (заказ в процессе)
  if (userStates[ctx.chat.id]) {
    await handleOrderState(ctx);
    return;
  }

  // 3. Если это обычное сообщение без состояния
  if (ctx.message.text && !ctx.message.text.startsWith('/')) {
    await ctx.reply('Чтобы сделать заказ, нажмите "📋 Menu"');
  }
});

// Функция обработки состояния заказа
async function handleOrderState(ctx) {
  const state = userStates[ctx.chat.id];
  const userInput = ctx.message.text.trim();

  try {
    if (state.step === "pavilion") {
      if (!userInput) {
        await ctx.reply("Пожалуйста, введите номер павильона:");
        return;
      }
      
      state.pavilion = userInput;
      state.step = "phone";
      await ctx.reply("Введите номер телефона:");
      
    } else if (state.step === "phone") {
      if (!userInput) {
        await ctx.reply("Пожалуйста, введите номер телефона:");
        return;
      }
      
      state.phone = userInput;
      
      // Формируем заказ
      const orderText = state.order.items
        .map(item => `• ${item.name} x${item.quantity}`)
        .join("\n");
      
      // Отправляем админу
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `📦 НОВЫЙ ЗАКАЗ!\n\n` +
        `🏢 Павильон: ${state.pavilion}\n` +
        `📞 Телефон: ${state.phone}\n\n` +
        `🛒 Заказ:\n${orderText}\n\n` +
        `⏰ Время: ${new Date().toLocaleString('ru-RU')}`
      );
      
      await ctx.reply("✅ Заказ успешно отправлен администратору! Ожидайте звонка для подтверждения.");
      
      // Удаляем состояние
      delete userStates[ctx.chat.id];
    }
  } catch (error) {
    console.error("Ошибка при обработке заказа:", error);
    await ctx.reply("❌ Произошла ошибка при обработке заказа. Попробуйте еще раз.");
    delete userStates[ctx.chat.id];
  }
}

// Express сервер
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
