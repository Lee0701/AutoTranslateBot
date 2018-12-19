
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

const google = require('./google-translator.js')
const papago = require('./papago-translator.js')

const modes = {
  "google": google,
  "papago": papago,
}

const trCommand = new RegExp('^/(atr)(@' + botId + ')?(?: ([\\s\\S]*))?')

let groups = {}

let queue = {}
let history = {}

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
  if(msg.text.startsWith('^')) return
  if(msg.text.startsWith('/')) return
  translateMessage(msg, result => {
    bot.sendMessage(msg.chat.id, result).then(sent => {
      history[msg.chat.id][msg.message_id] = sent.message_id
      setTimeout(() => {
        delete history[msg.chat.id][msg.message_id]
      }, 5*60*1000)
    })
    delete queue[msg.chat.id][msg.message_id]
  })
})

bot.on('edited_message', (msg) => {
  if(!msg.text) return
  if(msg.text.startsWith('^')) {

    return
  }
  if(history[msg.chat.id] && history[msg.chat.id][msg.message_id]) {
    translateMessage(msg, result => {
      bot.editMessageText(result, {chat_id: msg.chat.id, message_id: history[msg.chat.id][msg.message_id]})
    })
  }
})

const translateMessage = function(msg, callback) {
  if(groups[msg.chat.id]) {
    groups[msg.chat.id].forEach(language => {
      if(!queue[msg.chat.id]) queue[msg.chat.id] = {}
      if(!history[msg.chat.id]) history[msg.chat.id] = {}
      queue[msg.chat.id][msg.message_id] = []
      modes[language.mode](msg.text, language.language, result => {
        if(!queue[msg.chat.id][msg.message_id]) return
        queue[msg.chat.id][msg.message_id].push({language: language.language, text: result})
        if(checkComplete(msg)) {
          const result = getResult(msg)
          callback(result)
        }
      })
    })
  }
}

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
          const mode = args[2] || 'google'
          groups[chatId].push({language: language, mode: mode})
          save()
          reply(msg, 'Added language: ' + language)
        } else {
          reply(msg, 'Usage: /addlang <langcode>')
        }
      } else if(args[0] === 'dellang') {
        if(args.length >= 2) {
          const language = args[1]
          const index = groups[chatId].indexOf(groups[chatId].find(e => e.language === language))
          if(index >= 0) groups[chatId].splice(index, 1)
          save()
          reply(msg, 'Removed language: ' + language)
        } else {
          reply(msg, 'Usage: /dellang <langcode>')
        }
      } else if(args[0] === 'listlang') {
        let result = 'Languages: '
        groups[chatId].forEach(language => {
          result += '\n- ' + language.language + ' - ' + language.mode
        })
        reply(msg, result)
      } else if(args[0] === 'reset') {
        if(groups[chatId]) {
          delete groups[chatId]
          save()
          reply(msg, 'Settings reset.')
        } else {
        reply(msg, 'Error!' + language)
        }
      }
    } else {
      reply(msg, 'Usage: ')
    }
  })
}

const checkComplete = function(msg) {
  return groups[msg.chat.id] && groups[msg.chat.id].every(language => queue[msg.chat.id][msg.message_id].find(e => e.language === language.language) !== undefined)
}

const getResult = function(msg) {
  let name = msg.from.first_name
  if(msg.from.last_name) name += ' ' + msg.from.last_name
  //if(msg.from.username) name += ' @' + msg.from.username
  let message = ''
  const preprocessed = queue[msg.chat.id][msg.message_id].filter(e => e.text !== msg.text)
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
