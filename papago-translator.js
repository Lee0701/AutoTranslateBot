
const request = require('request')

module.exports = function(text, language, callback) {
  const from = 'auto'
  const to = language === 'zh_CN' ? 'zh-CN' : language === 'zh_TW' ? 'zh-TW' : language.split('_')[0]

  const base = 'rlWxnJA0Vwc0paIyLCJkaWN0RGlzcGxheSI6NSwic291cmNlIjoi'
  const str = '' + from + '","target":"' + to + '","text":"' + text + '"}'
  const data = 'data=' + base + Buffer.from(str).toString('base64')

  const options = {
    url: 'https://papago.naver.com/apis/n2mt/translate',
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: data,
  }

  request(options, (err, res, body) => {
    if(err) {
      console.log(err)
      return
    }
    callback(JSON.parse(body).translatedText)
  })

}
