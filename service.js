const StoreServer = require('./server')
const service = require('os-service')

module.exports = function run (args) {
  service.run(() => {
    service.stop()
  })
  StoreServer.createServer(args).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
