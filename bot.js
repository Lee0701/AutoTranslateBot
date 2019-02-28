require('dotenv').config()
const config = require('./config.js')

const http = require('http')

const botToken = config.botToken

const Telegraf = require('telegraf')
const bot = new Telegraf(config.botToken)

const emojiFlags = require('emoji-flags')

const fs = require('fs')

const { Client } = require('pg');
const client = new Client({
  connectionString: config.dbUrl,
  ssl: config.dbSsl
})
if(config.useDb) client.connect()

const franc = require('franc')
const isoConvert = require('iso-639-3-to-1')
const CountryLanguage = require('country-language')

const google = require('./google-translator.js')
const papago = require('./papago-translator.js')
const baidu = require('./baidu-translator.js')

const modes = {
  "google": google,
  "papago": papago,
  "baidu": baidu,
}

let groups = {}

let history = {}

const FROM_TO_SEP = '->'

const load = function() {
  if(config.useDb) {
    client.query('select * from data;', (err, res) => {
      if(err) {
          console.error(err)
        return
      }
      res.rows.forEach(row => {
        if(row.key === 'groups') groups = JSON.parse(row.value)
      })
    })
  } else {
    fs.readFile(config.fileName, (err, data) => {
      if(err) console.error(err)
      else groups = JSON.parse(data.toString())
    })
  }
}

const save = function() {
  const value = JSON.stringify(groups)
  if(config.useDb) {
    client.query('select * from data;', (err, res) => {
      if(err) {
        console.error(err)
        return
      }
      if(res.rows.length > 0) client.query("update data set value='" + value + "';")
      else client.query("insert into data (key, value) values('groups', '" + value + "');")
    })
  } else {
    fs.writeFile(config.fileName, value, (err) => console.error(err))
  }
}

const onText = function(ctx) {
  const text = ctx.message.text
  if(text.startsWith('/')) return
  if(text.startsWith('^')) return
  if(hasLink(ctx.message) && !text.includes(' ')) return

  translateMessage(ctx.message, result => {
    ctx.telegram.sendMessage(ctx.chat.id, result).then(sent => {
      if(!history[ctx.chat.id]) history[ctx.chat.id] = {}
      history[ctx.chat.id][ctx.message.message_id] = sent.message_id
      setTimeout(() => {
        delete history[ctx.chat.id][ctx.message.message_id]
      }, 5*60*1000)
    })
  })
  return true
}

bot.on('edited_message', (ctx) => {
  const msg = ctx.editedMessage
  if(msg.text.startsWith('^')) {

    return true
  }
  if(history[ctx.chat.id] && history[msg.chat.id][msg.message_id]) {
    translateMessage(msg, result => {
      ctx.telegram.editMessageText(ctx.chat.id, history[ctx.chat.id][msg.message_id], null, result)
    })
  }
})

const translateMessage = function(msg, callback) {
  if(groups[msg.chat.id]) {
    const fromLang = isoConvert(franc(msg.text))
    CountryLanguage.getLanguage(fromLang, (err, result) => {
      const from = err ? 'auto' : fromLang + '_' + result.countries[0].code_2
      const explicit = groups[msg.chat.id].filter(({language}) => language.includes(FROM_TO_SEP) && language.split(FROM_TO_SEP)[0].startsWith(from.split('_')[0]))
      const explicitLanguages = explicit.map(({language}) => language.split(FROM_TO_SEP)[1])
      const rest = groups[msg.chat.id].filter(({language}) => !language.includes(FROM_TO_SEP) && !explicitLanguages.includes(language))
      const languages = explicit.concat(rest)

      let name = msg.from.first_name
      if(msg.from.last_name) name += ' ' + msg.from.last_name

      const results = []
      const getDest = (l) => l.includes(FROM_TO_SEP) ? l.split(FROM_TO_SEP)[1] : l
      const check = (l) => results.filter(result => result.language.split('_')[0] == l).length == languages.filter(({language}) => getDest(language).split('_')[0] == l).length
      const checkComplete = () => languages.every(({language}) => check(getDest(language).split('_')[0]))
      languages.forEach(({language, mode}) => {
        const to = getDest(language)
        //console.log(`${from}->${to}, ${mode}`)
        modes[mode](msg.text, from, to, (translated) => {
          results.push({language: to, text: translated})
          if(checkComplete()) callback(getResult(name, msg.text, results))
        })
      })
    })
  }
}

const onTrCommand = function(ctx) {
  const msg = ctx.message
  ctx.telegram.getChatMember(ctx.chat.id, msg.from.id).then((member) => {
    if(!checkAdmin(member)) {
      ctx.reply('You are not admin!')
      return
    }
    const args = (ctx.update.message.text || '').split(/\s+/)
    args.splice(0, 1)
    if(args.length >= 1) {
      const chatId = ctx.chat.id
      if(!groups[chatId]) groups[chatId] = []
      if(args[0] === 'addlang') {
        if(args.length >= 2) {
          const language = args[1]
          const mode = args[2] || 'google'
          groups[chatId].push({language: language, mode: mode})
          save()
          ctx.reply('Added language: ' + language)
        } else {
          ctx.reply('Usage: /addlang <langcode>')
        }
      } else if(args[0] === 'dellang') {
        if(args.length >= 2) {
          const language = args[1]
          const index = groups[chatId].indexOf(groups[chatId].find(e => e.language === language))
          if(index >= 0) groups[chatId].splice(index, 1)
          save()
          ctx.reply('Removed language: ' + language)
        } else {
          ctx.reply('Usage: /dellang <langcode>')
        }
      } else if(args[0] === 'listlang') {
        let result = 'Languages: '
        groups[chatId].forEach(language => {
          result += '\n- ' + language.language + ' - ' + language.mode
        })
        ctx.reply(result)
      } else if(args[0] === 'reset') {
        if(groups[chatId]) {
          delete groups[chatId]
          save()
          ctx.reply('Settings reset.')
        } else {
        ctx.reply('Error!' + language)
        }
      }
    } else {
      ctx.reply('Usage: ')
    }
  })
  return true
}

const getResult = function(name, text, result) {
  let message = ''
  const preprocessed = result.filter(e => e.text !== text)
      .sort((a, b) => a.language < b.language ? -1 : a.language > b.language ? 1 : 0)
  for(i in preprocessed) {
    if(preprocessed[i].text === undefined) continue
    if(i != 0) message += ' '
    try {
      message += emojiFlags.countryCode(preprocessed[i].language.split('_')[1]).emoji
      message += ' ' + preprocessed[i].text
    } catch(e) {
      message += ' ' + preprocessed[i].language + ' ' + preprocessed[i].text
    }
  }
  if(message !== '') return name + ': ' + message
  else return undefined
}

const checkAdmin = function(member) {
  if(member.status === 'creator' || member.status === 'administrator') return true
  else return false
}

const hasLink = function(msg) {
  return msg.entities && msg.entities.length > 0
}

bot.command('atr', onTrCommand)
bot.on('text', onText)

bot.catch((err) => console.error(err))

bot.launch()

if(config.useWeb) {
  http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'})
    res.write('')
    res.end()
  }).listen(config.port || 80)
}

load()
