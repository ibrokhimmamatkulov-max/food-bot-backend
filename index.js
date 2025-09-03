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
  const webAppUrl = process.env.WEBAPP_URL || "https://food-bot-mini.onrender.com";
  ctx.reply("Откройте меню через мини-приложение", 
    Markup.keyboard([Markup.button.webApp("Открыть меню", webAppUrl)]).resize()
  );
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  // Если это команда /start или кнопка Menu - игнорируем, т.к. они уже обработаны
  if (ctx.message.text === '/start' || ctx.message.text === '📋 Menu') {
    return;
  }

  // Проверяем, есть ли состояние у пользователя
  if (userStates[ctx.chat.id]) {
    await handleOrderState(ctx);
  } else {
    // Если нет состояния, но пользователь что-то пишет - предлагаем открыть меню
    await ctx.reply('Чтобы сделать заказ, нажмите "📋 Menu"');
  }
});

// Обработка данных из mini-app
bot.on("message", async (ctx) => {
  if (ctx.message.web_app_data) {
    try {
      // Проверяем, что данные существуют
      if (!ctx.message.web_app_data.data) {
        throw new Error("No data received");
      }

      const data = JSON.parse(ctx.message.web_app_data.data);
      
      // Проверяем, что данные содержат items
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error("Invalid order format");
      }

      userStates[ctx.chat.id] = { 
        step: "pavilion", 
        order: data,
        createdAt: new Date()
      };
      
      await ctx.reply("Введите номер павильона:");
    } catch (err) {
      console.error("Ошибка обработки заказа:", err.message);
      await ctx.reply("Ошибка обработки заказа ❌\nПопробуйте еще раз.");
    }
  }
});

// Обработка состояний заказа
async function handleOrderState(ctx) {
  const state = userStates[ctx.chat.id];
  const userInput = ctx.message.text.trim();

  try {
    if (state.step === "pavilion") {
      // Валидация номера павильона
      if (!userInput || userInput.length > 10) {
        await ctx.reply("Пожалуйста, введите корректный номер павильона (максимум 10 символов):");
        return;
      }
      
      state.pavilion = userInput;
      state.step = "phone";
      await ctx.reply("Введите номер телефона:");
      
    } else if (state.step === "phone") {
      // Валидация телефона (базовая проверка)
      const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(userInput)) {
        await ctx.reply("Пожалуйста, введите корректный номер телефона:");
        return;
      }
      
      state.phone = userInput;
      
      // Формируем текст заказа
      const orderText = state.order.items
        .map(item => `• ${item.name} x${item.quantity} - ${item.price ? `${item.price}₽` : ''}`)
        .join("\n");
      
      const total = state.order.items.reduce((sum, item) => sum + (item.price * item.quantity || 0), 0);
      
      // Отправляем заказ администратору
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `📦 НОВЫЙ ЗАКАЗ!\n\n` +
        `👤 Пользователь: @${ctx.from.username || 'не указан'}\n` +
        `🏢 Павильон: ${state.pavilion}\n` +
        `📞 Телефон: ${state.phone}\n\n` +
        `🛒 Заказ:\n${orderText}\n\n` +
        `💵 Итого: ${total}₽\n` +
        `⏰ Время: ${new Date().toLocaleString('ru-RU')}`
      );
      
      await ctx.reply("✅ Заказ успешно отправлен администратору! Ожидайте звонка для подтверждения.");
      
      // Удаляем состояние пользователя
      delete userStates[ctx.chat.id];
    }
  } catch (error) {
    console.error("Ошибка при обработке заказа:", error);
    await ctx.reply("❌ Произошла ошибка при обработке заказа. Попробуйте еще раз.");
    delete userStates[ctx.chat.id];
  }
}

// Обработка ошибок бота
bot.catch((err, ctx) => {
  console.error(`Ошибка для пользователя ${ctx.chat.id}:`, err);
  ctx.reply("❌ Произошла непредвиденная ошибка. Попробуйте позже.");
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

// Включить обработку graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
