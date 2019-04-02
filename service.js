const PinServer = require('./server')

const yargs = require('yargs')

const argv = yargs
  .command('$0', 'Start the store service')
  .string('storage-location')
  .argv

const service = require('os-service')

service.run(() => {
  service.stop()
})

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

async function run () {
  await PinServer.createServer(argv)
}
