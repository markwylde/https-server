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

function start (opts) {
  let connections = {}

  chrome.sockets.tcpServer.create({}, function (createInfo) {
    chrome.sockets.tcpServer.listen(createInfo.socketId, opts.host || '127.0.0.1', opts.port, function (resultCode) {
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
      outputHandler: networkOutputHandler,
      tlsKey: opts.key,
      tlsCert: opts.cert
    })
  }

  chrome.sockets.tcp.onReceive.addListener(function (recvInfo) {
    let stringifiedData

    stringifiedData = arrayBufferToString(recvInfo.data)

    if (connections.hasOwnProperty(recvInfo.socketId)) {
      connections[recvInfo.socketId].process(stringifiedData)
    }
  })

  function networkOutputHandler (connection, responseComplete) {
    chrome.sockets.tcp.getInfo(connection.sessionId, function (info) {
      if (!info.connected) {
        return connection.close
      }

      let buf = stringToUint8Array(connection.tlsData.getBytes())
      if (buf.byteLength === 0) { return }

      chrome.sockets.tcp.send(connection.sessionId, buf.buffer, function (sendInfo) {
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
    return new Promise((resolve, reject) => {
      let hadMiddleware = false
      this.middleware.forEach(mw => {
        if (mw[0] === headers[0][0] && mw[1] === headers[0][1]) {
          hadMiddleware = true

          const req = {
            headers
          }

          const formDataStart = headers.find(el => el[0].length === 1)

          if (formDataStart > -1) {
            req.body = headers
              .slice(formDataStart)
              .reduce((acc, field) => {
                const spl = field.join().split('=')
                acc[spl[0]] = spl[1]
                return acc
              }, {})
          }

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
  post (route, fn) {
    this.middleware.push(['POST', route, fn])
  }
  put (route, fn) {
    this.middleware.push(['PUT', route, fn])
  }
  del (route, fn) {
    this.middleware.push(['DELETE', route, fn])
  }
  patch (route, fn) {
    this.middleware.push(['PATCH', route, fn])
  }

  listen () {
    let opts = {}

    opts.port = arguments[0]

    if (arguments[1] && typeof arguments[1] === 'string') {
      opts.host = arguments[1]
    }

    if (arguments[1] && typeof arguments[1] === 'object') {
      opts = Object.assign(opts, arguments[1])
    }

    if (arguments[2] && typeof arguments[2] === 'object') {
      opts = Object.assign(opts, arguments[2])
    }

    start.call(this, opts)
  }
}

module.exports = ServerHttps
if (window) window.ServerHttps = module.exports
