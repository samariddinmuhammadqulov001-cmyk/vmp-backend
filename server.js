require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// --- 1. MA'LUMOTLAR BAZASI MODELI ---
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    firstName: String,
    level: { type: String, default: 'Aniqlanmagan' },
    totalScore: { type: Number, default: 0 },
    lastSeen: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// --- 2. TELEGRAM BOT SOZLAMASI ---
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Start komandasi
bot.onText(/\/start/, async (msg) => {
    const { id, first_name } = msg.from;
    
    // Foydalanuvchini bazaga qo'shish yoki yangilash
    await User.findOneAndUpdate(
        { telegramId: id },
        { firstName: first_name, lastSeen: new Date() },
        { upsert: true }
    );

    bot.sendMessage(id, `Salom ${first_name}! 🇬🇧\nIngliz tili darajangizni aniqlashga tayyormisiz?`, {
        reply_markup: {
            inline_keyboard: [[{
                text: "🚀 Testni boshlash",
                web_app: { url: "https://sizning-saytingiz.netlify.app" }
            }]]
        }
    });
});

// Admin uchun Broadcast (Xabar yuborish) komandasi
// Ishlatish: /send Salom hammaga!
bot.onText(/\/send (.+)/, async (msg, match) => {
    if (msg.from.id.toString() === process.env.ADMIN_ID) {
        const text = match[1];
        const users = await User.find();
        users.forEach(user => {
            bot.sendMessage(user.telegramId, text).catch(err => console.log("Xabar yuborilmadi:", user.telegramId));
        });
        bot.sendMessage(msg.from.id, "✅ Xabar hamma foydalanuvchilarga yuborildi.");
    }
});

// --- 3. API ENDPOINTLAR (Frontend uchun) ---

// Natijalarni saqlash va dars tugagach xabar yuborish
app.post('/api/save-result', async (req, res) => {
    const { telegramId, score, level } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { telegramId },
            { level, $inc: { totalScore: score }, lastSeen: new Date() },
            { new: true }
        );

        if (user) {
            // Dars tugashi bilan botdan xabar yuborish
            bot.sendMessage(telegramId, `🎉 Ajoyib natija!\n\nBugungi ball: +${score}\nHozirgi darajangiz: ${level}\n\nErtaga yangi darslarni kutib qoling! 🔥`);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. AVTOMATIK ESLATMA (Cron Job) ---
// Har kuni soat 10:00 da 24 soat kirmaganlarga xabar yuboradi
cron.schedule('0 10 * * *', async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const inactiveUsers = await User.find({ lastSeen: { $lt: oneDayAgo } });

    inactiveUsers.forEach(user => {
        bot.sendMessage(user.telegramId, `👋 ${user.firstName}, sizni sog'indik!\nBugun hali dars qilmadingiz. Bilimingizni oshirish vaqtida keldi! 📚`);
    });
});

// --- 5. SERVERNI ISHGA TUSHIRISH ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(3000, () => console.log('Server va Bot ishga tushdi...'));
    })
    .catch(err => console.error("DB ulanishida xatolik:", err));