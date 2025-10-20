require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const BOT_KEY = process.env.BOT_KEY || "8244410500:AAEbNeW7u-VdexabOTyOtEfTc3tEFc9wCjE";
const WEATHER_API = process.env.WEATHER_API || "39a3ee21c848b47667142a8229f2a6c5";

const bot = new Telegraf(BOT_KEY)

bot.start((ctx)=>{
    ctx.reply("Welcome to Weather Bot! Send me a city name to get the current weather")
})

bot.hears(/[A-Za-z]+/i, async (ctx)=>{
    const city = ctx.message.text.trim()
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API}&units=metric`

    try {
        const response = await axios.get(url)
        const data = response.data
        const weather = data.weather[0].description
        const temp = data.main.temp

        ctx.reply(`${data.name}: ${temp}°C, ${weather}`)
    } catch (error){
        ctx.reply("Could not find the city. Please try again")
    }
})

bot.launch()
