module.exports = {
  botToken: process.env.BOT_TOKEN,
  useDb: process.env.USE_DB == 'true',
  fileName: 'groups.json',
  dbUrl: process.env.DB_URL,
  dbSsl: process.env.DB_SSL == 'true',
  useWeb: process.env.USE_WEB,
  port: process.env.PORT,
}
