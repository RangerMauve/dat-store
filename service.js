const PinServer = require('./server')

const yargs = require('yargs')

const argv = yargs
  .command('$0', 'Start the store service')
  .option('storage-location', {
    describe: 'The folder to store dats in'
  })
  .option('port', {
    describe: 'The port to use for the HTTP API',
    default: 3472
  })
  .option('host', {
    describe: 'The hostname to make the HTTP server listen on'
  })
  .option('verbose', {
    describe: 'Whether the HTTP server should output logs',
    default: true,
    type: 'boolean'
  })
  .option('p2p-port', {
    describe: 'The port to listen for P2P connections on',
    default: 3282
  })
  .option('latest', {
    describe: 'Whether to download just the latest changes',
    default: false,
    type: 'boolean'
  })
  .option('allow-cors', {
    describe: 'Allow CORS requests so any website can talk to the store',
    default: false,
    type: 'boolean'
  })
  .option('expose-to-internet', {
    describe: 'Allow connections from the internet, not just the localhost',
    default: false,
    type: 'boolean'
  })
  .option('authentication-username', {
    describe: 'Require users to use Basic Auth with this username to connect',
    default: '',
    type: 'string'
  })
  .option('authentication-password', {
    describe: 'Require users to use Basic Auth with this password to connect',
    default: '',
    type: 'password'
  })
  .option('manifest-timeout', {
    describe: 'time out if the PDA cannot be read with timeout milliseconds',
    default: 500
  })
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
