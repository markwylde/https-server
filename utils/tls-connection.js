const fs = require('fs')
const path = require('path')
const forge = require('node-forge')

var privateKey = fs.readFileSync(path.join(__dirname, '../keys/server.key'), 'utf8')
var certificate = fs.readFileSync(path.join(__dirname, '../keys/server.crt'), 'utf8')

module.exports = function (clientId, networkHandlers) {
  let textBuffer = ''
  let responseComplete = false

  return forge.tls.createConnection({
    server: true,
    caStore: [],

    cipherSuites: [
      forge.tls.CipherSuites.TLS_RSA_WITH_AES_128_CBC_SHA,
      forge.tls.CipherSuites.TLS_RSA_WITH_AES_256_CBC_SHA],

    sessionCache: {},
    sessionId: clientId,
    verifyClient: false,

    verify: function (c, verified, depth, certs) {
      return true
    },

    connected: function (connection) {
      // No need to do anything here
    },

    getCertificate: function (c, hint) {
      return networkHandlers.tlsCert || certificate
    },

    getPrivateKey: function (c, cert) {
      return networkHandlers.tlsKey || privateKey
    },

    tlsDataReady: function (connection) {
      networkHandlers.outputHandler(connection, responseComplete)
    },

    dataReady: async function (connection) {
      let textData = forge.util.decodeUtf8(connection.data.getBytes())
      textBuffer += textData

      if (textBuffer.indexOf('\r\n\r\n') > -1) {
        let paramsSplit = textBuffer
          .split('\n')
          .map(el => el.split(' '))
          .map(el => {
            el[0] = el[0].replace(':', '')
            return el
          })

        const response = await networkHandlers.prepareResponse(paramsSplit)

        if (typeof response === 'string') {
          responseComplete = true
          connection.prepare(forge.util.encodeUtf8(response))
        } else {
          responseComplete = true
          let buffer = forge.util.createBuffer()
          let headerBuffer = forge.util.createBuffer(response[0], 'utf8')
          let responseBuffer = forge.util.createBuffer(new Uint8Array(response[1]))
          buffer.putBuffer(headerBuffer)
          buffer.putBuffer(responseBuffer)

          connection.prepare(buffer)
        }
      }
    },

    closed: function (connection) {
      networkHandlers.disconnectHandler(connection.sessionId)
    },

    error: function (connection, error) {
      console.log('ERROR', error.message)
      connection.close()
      networkHandlers.disconnectHandler(connection.sessionId)
    }
  })
}
