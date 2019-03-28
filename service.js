const PinServer = require('./server')

// TODO: Parse a config file somewhere

const service = require('os-service')

service.run(() => {
  service.stop()
})

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

async function run () {
  console.log('Running pinning service')

  await PinServer.createServer({})

  console.log('Ready')
}
