const TelegramBot = require('node-telegram-bot-api')
const express = require('express')
const cors = require('cors')

const token = '6684868196:AAHL5ZuKu07_5pZsoC8d3zZSXbcJfnhfRDM'
const webAppUrl = 'https://master--playful-haupia-7b9264.netlify.app/'
const bot = new TelegramBot(token, {polling: true})
const app = express()

app.use(express.json())
app.use(cors())

bot.on('message', async msg => {
    const chatId = msg.chat.id
    const text = msg.text

    if (text === '/start') {
        await bot.sendMessage(chatId, 'Ниже появится кнопка, заполни форму', {
            reply_markup: {
               keyboard: [
                [{text: 'Заполнить форму', web_app: {url: webAppUrl + '/form'}}]
               ]
            }
        })


        await bot.sendMessage(chatId, 'Заходи в наш интернет магазин по кнопке ниже', {
            reply_markup: {
               inline_keyboard: [
                [{text: 'Сделать заказ', web_app: {url: webAppUrl}}]
               ]
            }
        })
    }

    if(msg?.web_app_data?.data) {
        try {
            const data = JSON.parse(msg?.web_app_data?.data)
            await bot.sendMessage(chatId, 'Спасибо, за обратную связь!')
            await bot.sendMessage(chatId, 'Ваша страна: ' + data.country)
            await bot.sendMessage(chatId, 'Ваша улица: ' + data.street)

            setTimeout(async () => {
                await bot.sendMessage(chatId, 'Всю информацию вы получите в этом чате')
            }, 3000)
        } catch (error) {  
            console.log(error);  
        }
    }
})

app.post('web-data', async (req, res) => {
    const {queryId, products, totalPrice} = req.body
    try {
        await bot.answerWebAppQuery(queryId, {
            type: 'article',
            id: queryId,
            title: 'Успешная покупка',
            input_message_content: {message_text: 'Поздравляю с покупкой, вы приобрели товар на сумму ' + totalPrice}
        })
        return res.status(200).json({})
    } catch (error) {
        await bot.answerWebAppQuery(queryId, {
            type: 'article',
            id: queryId,
            title: 'Не удалось приобрести товар',
            input_message_content: {message_text: 'Не удалось приобрести товар'}
        })
        return res.status(500).json({})
    }
})

const PORT = 3000
app.listen(PORT, () => {
    console.log('server stated ' + PORT);
})