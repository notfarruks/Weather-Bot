require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const BOT_KEY = process.env.BOT_KEY || "8244410500:AAEbNeW7u-VdexabOTyOtEfTc3tEFc9wCjE";
const WEATHER_API = process.env.WEATHER_API || "39a3ee21c848b47667142a8229f2a6c5";

const bot = new Telegraf(BOT_KEY)
const iconFor = (weatherId) => {
  if (weatherId >= 200 && weatherId < 300) return "⛈️";        // Thunderstorm
  if (weatherId >= 300 && weatherId < 400) return "🌦️";        // Drizzle
  if (weatherId >= 500 && weatherId < 600) return "🌧️";        // Rain
  if (weatherId >= 600 && weatherId < 700) return "❄️";        // Snow
  if (weatherId >= 700 && weatherId < 800) return "🌫️";        // Atmosphere (mist, fog…)
  if (weatherId === 800) return "☀️";                           // Clear
  if (weatherId > 800) return "⛅";                              // Clouds
  return "🌤️";
};
const summarizeDay = (slices) => {
  const temps = slices.map(s => s.main.temp);
  const min = Math.min(...temps).toFixed(1);
  const max = Math.max(...temps).toFixed(1);

  // pick most frequent weather code/description
  const count = {};
  for (const s of slices) {
    const w = s.weather[0];
    const key = `${w.id}|${w.description}`;
    count[key] = (count[key] || 0) + 1;
  }
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
  const [idStr, desc] = top.split("|");
  const emoji = iconFor(Number(idStr));

  return { min, max, desc, emoji };
};
const toLocalYMD = (unixSec, tzOffsetSec) => {
  const localMs = (unixSec + tzOffsetSec) * 1000;
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

bot.start((ctx)=>{
    ctx.reply("Welcome to Weather Bot! Send me a city name to get the current weather")
})

bot.command("forecast", async (ctx) => {
  // get city after the command
  const parts = ctx.message.text.split(" ");
  const city = parts.slice(1).join(" ").trim(); // supports multi-word cities
  if (!city) {
    return ctx.reply("📍 Please enter a city name.\nExample: /forecast baku");
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${process.env.WEATHER_API}&units=metric`;

  try {
    const res = await axios.get(url);
    const { city: cityMeta, list } = res.data;
    const tz = cityMeta.timezone || 0;

    // group slices by local date
    const buckets = {};
    for (const item of list) {
      const ymd = toLocalYMD(item.dt, tz);
      (buckets[ymd] ??= []).push(item);
    }

    // pick next 3 dates (today + next 2) that have data
    const dates = Object.keys(buckets).sort().slice(0, 3);

    if (dates.length === 0) {
      return ctx.reply("No forecast data available right now. Try later.");
    }

    let msg = `📅 3-Day Forecast for ${cityMeta.name}:\n`;
    for (const d of dates) {
      const summary = summarizeDay(buckets[d]);
      msg += `\n${summary.emoji} ${d}: ${summary.min}–${summary.max}°C, ${summary.desc}`;
    }

    await ctx.reply(msg);
  } catch (e) {
    // 404 city not found or other API errors
    await ctx.reply("❌ Could not find that city or fetch forecast. Please try again.");
  }
});


bot.hears(/[A-Za-z]+/i, async (ctx)=>{
    const city = ctx.message.text.trim()
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API}&units=metric`

    try {
        const response = await axios.get(url)
        const data = response.data
        const weather = data.weather[0].description
        const temp = data.main.temp

        const emoji = iconFor(weather.id)
        const message = `${emoji} ${data.name}: ${temp.toFixed(1)}°C, ${weather.description}`
        ctx.reply(message)
    } catch (error){
        ctx.reply("Could not find the city. Please try again")
    }
})

bot.on("inline_query", async (ctx) => {
  const query = ctx.inlineQuery.query.trim();
  if (!query) return; // nothing typed

  const city = query;
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.WEATHER_API}&units=metric`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${process.env.WEATHER_API}&units=metric`;

  try {
    // --- Current weather ---
    const curRes = await axios.get(currentUrl);
    const cur = curRes.data;
    const curWeather = cur.weather[0];
    const curEmoji = iconFor(curWeather.id);
    const currentText = `${curEmoji} ${cur.name}: ${cur.main.temp.toFixed(1)}°C, ${curWeather.description}`;

    // --- 3-Day Forecast ---
    const foreRes = await axios.get(forecastUrl);
    const { city: cityMeta, list } = foreRes.data;
    const tz = cityMeta.timezone || 0;

    // group slices by local date
    const buckets = {};
    for (const item of list) {
      const ymd = toLocalYMD(item.dt, tz);
      (buckets[ymd] ??= []).push(item);
    }
    const dates = Object.keys(buckets).sort().slice(0, 3);
    let forecastMsg = `📅 3-Day Forecast for ${cityMeta.name}:\n`;
    for (const d of dates) {
      const s = summarizeDay(buckets[d]);
      forecastMsg += `\n${s.emoji} ${d}: ${s.min}–${s.max}°C, ${s.desc}`;
    }

    // --- Prepare inline results ---
    const results = [
      {
        type: "article",
        id: "1",
        title: `🌡️ Current Weather — ${cur.name}`,
        description: `${cur.main.temp.toFixed(1)}°C, ${curWeather.description}`,
        input_message_content: { message_text: currentText },
        thumb_url: "https://openweathermap.org/img/wn/" + curWeather.icon + "@2x.png"
      },
      {
        type: "article",
        id: "2",
        title: `📅 3-Day Forecast — ${cityMeta.name}`,
        description: "Tap to send detailed forecast",
        input_message_content: { message_text: forecastMsg },
        thumb_url: "https://openweathermap.org/img/wn/" + list[0].weather[0].icon + "@2x.png"
      }
    ];

    await ctx.answerInlineQuery(results);
  } catch (e) {
    await ctx.answerInlineQuery([{
      type: "article",
      id: "0",
      title: "❌ City not found",
      input_message_content: { message_text: "Could not find that city." }
    }]);
  }
});



bot.launch()

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Weather Bot is running ✅'));
app.listen(process.env.PORT || 10000);

// Inline mode (type @YourBot Baku)
// Location-based weather (using Telegram’s location feature)