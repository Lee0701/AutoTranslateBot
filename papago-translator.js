
const request = require('request')

module.exports = function(text, fromLang, language, callback) {
  const from = fromLang === 'zh_CN' ? 'zh-CN' : fromLang === 'zh_TW' || fromLang === 'zh_HK' ? 'zh-TW' : fromLang.split('_')[0]
  const to = language === 'zh_CN' ? 'zh-CN' : language === 'zh_TW' || language === 'zh_HK' ? 'zh-TW' : language.split('_')[0]

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
      console.error(err)
      callback(undefined)
      return
    }
    callback(JSON.parse(body).translatedText)
  })

}
