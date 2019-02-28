
const https = require('https')

const TKK_REGEX = new RegExp("tkk:'(.*?)',")

const updateTKK = function() {
  const req = https.get('https://translate.google.com', (res) => {
    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })
    res.on('end', () => {
      const match = TKK_REGEX.exec(data)
      if(match) TKK = match[1]
    })
  }).on('error', (err) => console.error(err))
}

const generate = function(a){xr=function(a,b){for(var c=0;c<b.length-2;c+=3){var d=b.charAt(c+2),d="a"<=d?d.charCodeAt(0)-87:Number(d),d="+"==b.charAt(c+1)?a>>>d:a<<d;a="+"==b.charAt(c)?a+d&4294967295:a^d};return a};var b=TKK;var d=b.split(".");b=Number(d[0])||0;for(var e=[],f=0,g=0;g<a.length;g++){var l=a.charCodeAt(g);128>l?e[f++]=l:(2048>l?e[f++]=l>>6|192:(55296==(l&64512)&&g+1<a.length&&56320==(a.charCodeAt(g+1)&64512)?(l=65536+((l&1023)<<10)+(a.charCodeAt(++g)&1023),e[f++]=l>>18|240,e[f++]=l>>12&63|128):e[f++]=l>>12|224,e[f++]=l>>6&63|128),e[f++]=l&63|128)};a=b;for(f=0;f<e.length;f++) a+=e[f],a=xr(a,"+-a^+6");a=xr(a,"+-3^+b+-f");a^=Number(d[1])||0;0>a&&(a=(a&2147483647)+2147483648);a%=1E6;return a.toString()+"."+(a^b)}

updateTKK()

module.exports = function(text, from, to, callback) {
  let token = generate(text)
  if(!token) {
    updateTKK()
    token = generate(text)
  }
  const url = "https://translate.googleapis.com/translate_a/single?client=t"
      + "&tk=" + token
      + "&ie=UTF-8"
      + "&oe=UTF-8"
      + "&sl=" + from
      + "&tl=" + to
      + "&dt=t&q=" + encodeURIComponent(text)
  const req = https.get(url, (res) => {
    res.setEncoding('utf-8')
    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })
    res.on('end', () => {
      try {
        const result = JSON.parse(data)[0][0][0]
        callback(result)
      } catch(e) {
        console.error(e)
        callback(undefined)
      }
    })
  }).on('error', (err) => {
    console.error(err)
    callback(undefined)
  })
}
