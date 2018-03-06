const createTLSConnection = require('../utils/tls-connection.js')
const {arrayBufferToString, stringToUint8Array} = require('../utils/string-array')

function createHtmlResponse (status, response) {
  return [
    `HTTP/1.1 ${status} OK`,
    new Date().toString(),
    'Content-Type: text/html',
    `Content-Length: ${response.length}`,
    'Connection: close',
    '',
    response,
    '\r\n'
  ].join('\r\n')
}

function createBinaryResponse (status, contentType, response) {
  return [[
    `HTTP/1.1 ${status} OK`,
    new Date().toString(),
    `Content-Type: ${contentType}`,
    `Content-Length: ${response.length}`,
    'Connection: close',
    '',
    ''
  ].join('\r\n'), response]
}

function start () {
  let connections = {}

  chrome.sockets.tcpServer.create({}, function (createInfo) {
    chrome.sockets.tcpServer.listen(createInfo.socketId, '127.0.0.1', 9999, function (resultCode) {
      if (resultCode < 0) {
        return console.log(`Error listening: ${chrome.runtime.lastError.message}`)
      }

      chrome.sockets.tcpServer.onAccept.addListener(onAccept)
    })
  })

  const onAccept = info => {
    let clientId = info.clientSocketId

    chrome.sockets.tcp.setPaused(clientId, false)
    connections[clientId] = createTLSConnection(clientId, {
      prepareResponse: this.runMiddleware.bind(this),
      disconnectHandler: networkDisconnectHandler,
      outputHandler: networkOutputHandler
    })
    console.log(`TLS Connection started on socket ${clientId}`)
  }

  chrome.sockets.tcp.onReceive.addListener(function (recvInfo) {
    let stringifiedData

    console.log(`received data length ${recvInfo.data.byteLength} on socket ${recvInfo.socketId}`)

    stringifiedData = arrayBufferToString(recvInfo.data)

    console.log('processing encrypted data through tls')
    if (connections.hasOwnProperty(recvInfo.socketId)) {
      connections[recvInfo.socketId].process(stringifiedData)
    }
  })

  function networkOutputHandler (connection, responseComplete) {
    chrome.sockets.tcp.getInfo(connection.sessionId, function (info) {
      if (!info.connected) {
        console.log('The socket is no longer connected')
        return connection.close
      }

      let buf = stringToUint8Array(connection.tlsData.getBytes())
      if (buf.byteLength === 0) { return }

      console.log(`Sending ${buf.byteLength} encrypted bytes to socket: ${connection.sessionId}`)

      chrome.sockets.tcp.send(connection.sessionId, buf.buffer, function (sendInfo) {
        console.log(`sent encrypted bytes ${JSON.stringify(sendInfo)}`)
        if (responseComplete) {
          connection.close()
          delete connections[connection.socketId]
        }
      })
    })
  }

  function networkDisconnectHandler (socket) {
    chrome.sockets.tcp.disconnect(socket)
    delete connections[socket]
  }
}

class ServerHttps {
  constructor () {
    this.middleware = []
  }

  runMiddleware (headers) {
    console.log({headers})

    return new Promise((resolve, reject) => {
      let hadMiddleware = false
      this.middleware.forEach(mw => {
        if (mw[0] === headers[0][0] && mw[1] === headers[0][1]) {
          hadMiddleware = true
          const req = headers
          const res = {
            send: function (response) {
              resolve(createHtmlResponse(200, response))
            },

            sendFile: function (status, contentType, response) {
              resolve(createBinaryResponse(200, contentType, response))
            }
          }
          mw[2](req, res)
        }
      })

      if (!hadMiddleware) {
        const response = 'Not Found'
        resolve(createHtmlResponse(404, response))
      }
    })
  }

  get (route, fn) {
    this.middleware.push(['GET', route, fn])
  }

  listen () {
    if (arguments.length === 1) {
      start.call(this, {port: arguments[0]})
    } else {
      start.call(this, {host: arguments[0], port: arguments[1]})
    }
  }
}

module.exports = ServerHttps
if (window) window.ServerHttps = module.exports
