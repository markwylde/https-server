# HTTPS Server for Chrome Apps
This library is made specifically for running an HTTPS server as a ChromeOS app.

## Example
The `dist/https-server.js` has been built with browserify but you can just load it into the webpage
and access it via the window object for testing.

```javascript
const https = new ServerHttps()

https.get('/', function (req, res) {
  res.send('hello there')
})

https.listen(9999)
```

## Demo
You can view the [https-server-demo](https://github.com/markwylde/https-server-demo) for a more advanced demo
