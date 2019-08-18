# HTTPS Server for Chrome Apps
This library is made specifically for running an HTTPS server as a ChromeOS app.

## Usage
You can call `get`, `post`, `put`, `delete` or `patch` just like in Express to create a route.

When called the routes will be given a `req` and `res`. Currently you can get an array of raw headers
on req, and for mutatable methods you can get the body via `req.body`.

To send a response you call `res.send` or `res.sendFile`.

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

# License
This project is licensed under the terms of the GPLv3 license.
