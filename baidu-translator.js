
const api = require('baidu-translate-api')

const LANG_CONVERT = {
  'zh_CN': 'zh',
  'zh_TW': 'cht',
  'zh_HK': 'cht',
  'ja': 'jp',
  'ko': 'kor',
  'fr': 'fra',
  'es': 'spa',
}

module.exports = function(text, fromLang, toLang, callback) {
  const from = LANG_CONVERT[fromLang] || LANG_CONVERT[fromLang.split('_')[0]] || fromLang
  const to = LANG_CONVERT[toLang] || LANG_CONVERT[toLang.split('_')[0]] || toLang

  api(text, {from, to}).then(({trans_result}) => callback(trans_result.dst)).catch(reason => (console.error(reason), callback(undefined)))

}
