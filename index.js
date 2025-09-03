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
const PORT = process.env.PORT || 10000;

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

// Обработка ВСЕХ сообщений
bot.on("message", async (ctx) => {
  console.log('Получено сообщение:', ctx.message.text);
  
  if (ctx.message.web_app_data) {
    try {
      console.log("Данные из WebApp:", ctx.message.web_app_data.data);
      
      if (!ctx.message.web_app_data.data) {
        throw new Error("No data received");
      }

      const data = JSON.parse(ctx.message.web_app_data.data);
      console.log("Parsed data:", data);
      
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error("Invalid order format");
      }

      userStates[ctx.chat.id] = { 
        step: "pavilion", 
        order: data,
        createdAt: new Date()
      };
      
      await ctx.reply("Введите номер павильона:");
      return;
      
    } catch (err) {
      console.error("Ошибка обработки заказа:", err.message);
      await ctx.reply("Ошибка обработки заказа ❌\nПопробуйте еще раз.");
      return;
    }
  }

  if (userStates[ctx.chat.id]) {
    console.log("Обработка состояния пользователя:", userStates[ctx.chat.id].step);
    await handleOrderState(ctx);
    return;
  }

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
      
      const orderText = state.order.items
        .map(item => `• ${item.name} x${item.quantity}`)
        .join("\n");
      
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `📦 НОВЫЙ ЗАКАЗ!\n\n` +
        `🏢 Павильон: ${state.pavilion}\n` +
        `📞 Телефон: ${state.phone}\n\n` +
        `🛒 Заказ:\n${orderText}\n\n` +
        `⏰ Время: ${new Date().toLocaleString('ru-RU')}`
      );
      
      await ctx.reply("✅ Заказ успешно отправлен администратору! Ожидайте звонка для подтверждения.");
      delete userStates[ctx.chat.id];
    }
  } catch (error) {
    console.error("Ошибка при обработке заказа:", error);
    await ctx.reply("❌ Произошла ошибка при обработке заказа. Попробуйте еще раз.");
    delete userStates[ctx.chat.id];
  }
}

// Настройка webhook маршрута
app.post('/webhook', (req, res) => {
  console.log('Webhook received');
  bot.handleUpdate(req.body, res);
});

app.get("/", (req, res) => {
  res.send("Bot server is running...");
});

// ЗАПУСКАЕМ ТОЛЬКО EXPRESS СЕРВЕР!
// Telegraf будет использовать существующий Express сервер
app.listen(PORT, async () => {
  console.log(`🌐 Сервер запущен на порту ${PORT}`);
  
  try {
    // Устанавливаем webhook для бота
    await bot.telegram.setWebhook(`https://food-bot-backend-9zck.onrender.com/webhook`);
    console.log('✅ Webhook установлен');
  } catch (error) {
    console.error('❌ Ошибка установки webhook:', error);
  }
});

// Убираем bot.launch() полностью!
// Telegraf будет обрабатывать запросы через Express
