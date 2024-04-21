const TelegramBot = require('node-telegram-bot-api')
const express = require('express')
const axios = require('axios')
const cors = require('cors')
const { createWorker } = require('tesseract.js');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('users.db');
const fs = require('fs');


db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, number TEXT, owner TEXT, phone TEXT)");
});

function replaceEnglishLetters(str) {
    const replacements = {
        A: 'А',
        B: 'В',
        E: 'Е',
        K: 'К',
        M: 'М',
        H: 'Н',
        O: 'О',
        P: 'Р',
        C: 'С',
        T: 'Т',
        Y: 'У',
        X: 'Х'
    };

    return str.split('').map(char => replacements[char] || char).join('');
}

const token = '6905969776:AAFNJRnHiHKIIdrypeWM_YCDzu34cPyq3fo'
const bot = new TelegramBot(token, {polling: true})
const app = express()

app.use(express.json())
app.use(cors())

bot.setMyCommands([
    {command: '/start', description: "Начальное приветствие"},
    {command: '/add', description: "Добавить номер в базу"},
    {command: '/info', description: "Инструкция к использованию"},
    {command: '/photo', description: "Найти по номеру на фото"},
    {command: '/find', description: "Найти по номеру"}  
])

const registrationState = {};

async function waitForMessage(chatId) {
    return new Promise(resolve => {
        bot.once('message', async (message) => {
            resolve(message);
        });
    });
}


bot.on('message', async msg => {
    const chatId = msg.chat.id
    const text = msg.text

    if (text === '/start') {
        await bot.sendSticker(chatId, 'https://tlgrm.eu/_/stickers/4a4/f28/4a4f2880-e005-3f8f-ab47-2bb189e7d263/29.webp')
        await bot.sendMessage(chatId, '💀 Для поиска машины по номеру, пиши /find! ')
    }

    if (text === '/info') {
        await bot.sendSticker(chatId, 'https://tlgrm.eu/_/stickers/17a/d1d/17ad1d46-6d6d-3ff7-bbd4-9d054d9154c1/38.webp')
        await bot.sendMessage(chatId, `Привет! я  NOMEROGRAMBOT созданный специально  что бы упростить работу в нашей компании 
1️⃣.Начните диалог: Нажмите кнопку "Start" или отправьте боту команду /start, чтобы начать диалог.
2️⃣.Отправьте номер автомобиля: Введите номер автомобиля, который вы хотите проверить, и отправьте его боту.                                                           
3️⃣.Если вы новый сотрудник компании введите ФИО номер телефона,номер машины`)
    }

    if (text === '/find') {
        await bot.sendMessage(chatId, 'Введите номер машины. Например А123АП126: ')
        let result;
        db.serialize(() => {
            db.all("SELECT * FROM users", (err, rows) => {
                if (err) {
                    console.error(err.message);
                    return;
                }
                bot.once('message', async message => {
                    if (chatId === message.chat.id) {
                        rows.map(numer => {
                            if(numer.number.toLowerCase() == message.text.toLowerCase()) {
                                result = numer
                            } 
                        })
                        if(result) {
                            await bot.sendMessage(message.chat.id, 'Владелец: ' + result.owner)
                            await bot.sendMessage(message.chat.id, 'Номер телефона: ' + result.phone)
                            return await bot.sendSticker(message.chat.id, 'https://tlgrm.eu/_/stickers/592/e1c/592e1ce3-ec50-4ba8-8632-c1b97d404a73/51.webp')
                        } else {
                            await bot.sendMessage(message.chat.id, 'Ничего не найдено')
                        }
                    }
                })
            });
        });

    }

    if (text === '/photo') {
        await bot.sendMessage(chatId, 'Отправьте фото номера машины: '); 
        
        bot.once('photo', async (message) => {
            if (chatId === message.chat.id) {
                const photoId = message.photo[message.photo.length - 1].file_id;
                
                try {
                    const photoUrl = await bot.getFileLink(photoId);
                    
                    const response = await axios.get(photoUrl, { responseType: 'arraybuffer' });
                    const imageBuffer = Buffer.from(response.data);
            
                    fs.writeFileSync('temp_photo.jpg', imageBuffer);
            
                    const worker = await createWorker('eng');
            
                    worker.setParameters({
                        tessedit_char_whitelist: '0123456789ABEKMHOPCTYX'
                    })
    
                    const { data: { text } } = await worker.recognize('temp_photo.jpg');
            
                    fs.unlinkSync('temp_photo.jpg');
            
                    let str = replaceEnglishLetters(text.trim())
                    await bot.sendMessage(message.chat.id, `Распознанный номер машины: ${str}`);
                    await worker.terminate();
                    let result;
                    db.serialize(() => {
                        db.all("SELECT * FROM users", async (err, rows) => {
                            if (err) {
                                console.error(err.message);
                                return;
                            }
                            rows.map(numer => {
                                if(numer.number.toLowerCase() == str.toLowerCase()) {
                                    result = numer
                                } 
                            })
                            if(result) {
                                await bot.sendMessage(message.chat.id, 'Владелец: ' + result.owner)
                                await bot.sendMessage(message.chat.id, 'Номер телефона: ' + result.phone)
                                return await bot.sendSticker(message.chat.id, 'https://tlgrm.eu/_/stickers/592/e1c/592e1ce3-ec50-4ba8-8632-c1b97d404a73/51.webp')
                            } else {
                                await bot.sendMessage(message.chat.id, 'Ничего не найдено')
                            }
                        });
                    });
                } catch (error) {
                    console.error('Ошибка при обработке фотографии:', error);
                }
            }
        });

    }

    
    if (text === '/add') {
        await bot.sendMessage(chatId, 'Введите ФИО владельца авто: ');
        // Устанавливаем флаг в true для пользователя, который начал процесс добавления
        registrationState[chatId] = { inProgress: true };
        bot.once('message', async (message1) => {   
            if (chatId === message1.chat.id) {
                let owner = message1.text; 
                while (!/^[А-ЯЁа-яё]/.test(owner)) {
                    await bot.sendMessage(message1.chat.id, 'Введите корректное ФИО');
                    await bot.sendMessage(message1.chat.id, 'Введите ФИО владельца авто: ');
                    message1 = await waitForMessage(message1.chat.id);
                    owner = message1.text.trim();
                }
        
                await bot.sendMessage(message1.chat.id, 'Введите телефон владельца авто: ');
                bot.once('message', async (message2) => {
                    if (chatId === message2.chat.id) {
                        let phone = message2.text.trim(); 
                        while (!/^\d{11}$/.test(phone)) {
                            await bot.sendMessage(message2.chat.id, 'Некорректный формат номера телефона. Пожалуйста, введите 11 цифр без пробелов и специальных символов.');
                            await bot.sendMessage(message2.chat.id, 'Введите телефон владельца авто: ');
                            message2 = await waitForMessage(message2.chat.id);
                            phone = message2.text.trim();
                        }
            
                        await bot.sendMessage(message2.chat.id, 'Введите номер авто. Например А123АП26: ');
                        bot.once('message', async (message3) => {
                            if (chatId === message3.chat.id) {
                                let number = message3.text.trim(); 
                                while (!/^[А-ЯЁA-Z]{1}\d{3}[А-ЯЁA-Z]{2}\d{2,3}$/.test(number)) {
                                    await bot.sendMessage(message3.chat.id, 'Некорректный формат номера авто. Пожалуйста, используйте латинские буквы и цифры, длина номера должна быть от 7 до 9 символов.');
                                    await bot.sendMessage(message3.chat.id, 'Введите номер авто. Например А123АП26: ');
                                    message3 = await waitForMessage(message3.chat.id);
                                    number = message3.text.trim();
                                }
                
                                const result = { owner, phone, number };
                                db.serialize(() => {
                                    db.run("INSERT INTO users (number, owner, phone) VALUES (?, ?, ?)", [result.number, result.owner, result.phone], function(err) {
                                        if (err) {
                                            return console.error(err.message);
                                        }
                                    });
                                });
                                await bot.sendSticker(message3.chat.id, 'https://tlgrm.eu/_/stickers/592/e1c/592e1ce3-ec50-4ba8-8632-c1b97d404a73/3.webp')
                                await bot.sendMessage(message3.chat.id, "Готово");

                                // Удаляем флаг состояния регистрации для этого пользователя
                                delete registrationState[chatId];
                            }
                        });
                    }
                });
            }
        });
    }

})


const PORT = 3000
app.listen(PORT, () => {
    console.log('server stated ' + PORT);
})

