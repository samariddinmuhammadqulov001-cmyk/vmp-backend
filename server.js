const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. Middleware sozlamalari
app.use(cors()); // Netlify'dan keladigan so'rovlarga ruxsat beradi
app.use(express.json());

// 2. O'zgaruvchilarni yuklash
const token = process.env.BOT_TOKEN;
const mongoUri = process.env.MONGO_URI;
const port = process.env.PORT || 10000; // Render uchun juda muhim

// 3. MongoDB ulanishi
mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB-ga muvaffaqiyatli ulandi'))
    .catch((err) => console.error('MongoDB ulanishida xato:', err));

// 4. Foydalanuvchi sxemasi (Ma'lumotlar bazasi uchun)
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    username: String,
    score: { type: Number, default: 0 },
    lastPlayed: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// 5. Telegram Bot sozlamasi (polling orqali)
const bot = new TelegramBot(token, { polling: true });

// Bot xatolarini ushlash (409 Conflict'ni kamaytirish uchun)
bot.on('polling_error', (error) => {
    console.log(`Polling xatosi: ${error.code} - ${error.message}`);
});

// 6. Bot komandalari
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "VMP test loyihasiga xush kelibsiz! O'yinni boshlash uchun saytga kiring.");
});

// 7. API Endpoints (Frontend uchun)

// Render "tirikligini" tekshirishi uchun asosiy yo'l
app.get('/', (req, res) => {
    res.send('Backend va Bot muvaffaqiyatli ishlamoqda!');
});

// Natijalarni saqlash API'si
app.post('/api/save-score', async (req, res) => {
    const { userId, username, score } = req.body;

    try {
        let user = await User.findOneAndUpdate(
            { userId },
            { username, score, lastPlayed: Date.now() },
            { upsert: true, new: true }
        );
        
        bot.sendMessage(userId, `Tabriklaymiz! Sizning yangi natijangiz: ${score} ball.`);
        res.status(200).json({ success: true, message: 'Natija saqlandi' });
    } catch (error) {
        console.error('Saqlashda xato:', error);
        res.status(500).json({ success: false, message: 'Serverda xato yuz berdi' });
    }
});

// 8. Serverni ishga tushirish (Render uchun eng muhim qismi)
app.listen(port, '0.0.0.0', () => {
    console.log(`Server ${port}-portda ishlamoqda...`);
});