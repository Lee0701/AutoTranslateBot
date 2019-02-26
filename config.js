module.exports = {
  botId: process.env.BOT_ID,
  botToken: process.env.BOT_TOKEN,
  dbUrl: process.env.DB_URL,
  dbSsl: process.env.DB_SSL == 'true',
  port: process.env.PORT,
}
