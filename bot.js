
const config = require('./config.js')

const http = require('http')

const botToken = config.botToken
const botId = config.botId

const TelegramBot = require('node-telegram-bot-api')
const bot = new TelegramBot(botToken, {polling: true})

const emojiFlags = require('emoji-flags')

const { Client } = require('pg');
const client = new Client({
  connectionString: config.dbUrl,
  ssl: true
})
client.connect()

const translate = require('./translate.js')

const trCommand = new RegExp('^/(atr)(@' + botId + ')?(?: ([\\s\\S]*))?')

let groups = {}

let queue = {}

const load = function() {
  client.query('select * from data;', (err, res) => {
    if(err) {
      console.log(err)
      return
    }
    res.rows.forEach(row => {
      if(row.key === 'groups') groups = JSON.parse(row.value)
    })
  })
}

const save = function() {
  const value = JSON.stringify(groups)
  client.query('select * from data;', (err, res) => {
    if(err) {
      console.log(err)
      return
    }
    if(res.rows.length > 0) client.query("update data set value='" + value + "';")
    else client.query("insert into data (key, value) values('groups', '" + value + "');")
  })
}

bot.on('message', (msg) => {
  if(!msg.text) return
  if(msg.text.startsWith('/')) return
  if(groups[msg.chat.id]) {
    groups[msg.chat.id].forEach(language => {
      queue[msg.message_id] = []
      translate(msg.text, language, result => {
        queue[msg.message_id].push({language: language, text: result})
        if(checkComplete(msg)) {
          sendResult(msg)
          delete queue[msg.message_id]
        }
      })
    })
  }
})

const onTrCommand = function(msg, match) {
  bot.getChatMember(msg.chat.id, msg.from.id).then((member) => {
    if(!checkAdmin(member)) {
      reply(msg, 'You are not admin!')
      return
    }
    const args = (match[3] || '').split(' ')
    if(args.length >= 1) {
      const chatId = msg.chat.id
      if(!groups[chatId]) groups[chatId] = []
      if(args[0] === 'addlang') {
        if(args.length >= 2) {
          const language = args[1]
          groups[chatId].push(language)
          save()
          reply(msg, 'Added language: ' + language)
        } else {
          reply(msg, 'Usage: /addlang <langcode>')
        }
      } else if(args[0] === 'dellang') {
        if(args.length >= 2) {
          const language = args[1]
          const index = groups[chatId].indexOf(language)
          if(index >= 0) groups[chatId].splice(index, 1)
          save()
          reply(msg, 'Removed language: ' + language)
        } else {
          reply(msg, 'Usage: /dellang <langcode>')
        }
      } else if(args[0] === 'listlang') {
        let result = 'Languages: '
        groups[chatId].forEach(language => {
          result += '\n- ' + language
        })
        reply(msg, result)
      }
    } else {
      reply(msg, 'Usage: ')
    }
  })
}

const checkComplete = function(msg) {
  return groups[msg.chat.id] && groups[msg.chat.id].every(language => queue[msg.message_id].find(e => e.language === language) !== undefined)
}

const sendResult = function(msg) {
  let message = ''
  const preprocessed = queue[msg.message_id].filter(e => e.text !== msg.text)
      .sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
  for(i in preprocessed) {
    if(i != 0) message += '\n'
    try {
      message += emojiFlags.countryCode(preprocessed[i].language.split('_')[1]).emoji + ' ' + preprocessed[i].text
    } catch(e) {
      message += preprocessed[i].language + ' ' + filtered[i].text
    }
  }
  reply(msg, message)
}

const reply = function(msg, text) {
  bot.sendMessage(msg.chat.id, text, {reply_to_message_id: msg.message_id})
}

const checkAdmin = function(member) {
  if(member.status === 'creator' || member.status === 'administrator') return true
  else return false
}

bot.onText(trCommand, onTrCommand)

bot.on('polling_error', (err) => {
  console.log(err)
})

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.write('')
  res.end()
}).listen(config.port || 80)

load()
