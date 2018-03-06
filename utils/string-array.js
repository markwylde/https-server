// Code taken and modified from chrome-app-samples/webserver
// which was under the Apache License 2.0

function arrayBufferToString (buffer) {
  let str = ''
  let uArrayVal = new Uint8Array(buffer)
  for (let s = 0; s < uArrayVal.length; s++) {
    str += String.fromCharCode(uArrayVal[s])
  }
  return str
}

function stringToUint8Array (string) {
  let buffer = new ArrayBuffer(string.length)
  let view = new Uint8Array(buffer)
  for (let i = 0; i < string.length; i++) {
    view[i] = string.charCodeAt(i)
  }
  return view
}

module.exports = {arrayBufferToString, stringToUint8Array}
