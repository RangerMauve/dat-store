const yargs = require('yargs')

const SERVICE_NAME = 'dat-store'

const addServiceOptions = (yargs) => yargs
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
  .option('dat-port', {
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
const addClientOptions = (yargs) => yargs
  .option('config-location')
const noOptions = () => void 0

const commands = yargs
  .scriptName(SERVICE_NAME)
  .command('add <url|path> [provider]', 'Add a Dat to your storage provider.', addServiceOptions, add)
  .command('remove <url|path> [provider]', 'Remove a Dat from your storage provider.', addServiceOptions, remove)
  .command('list [provider]', 'List the Dats in your storage provider.', addServiceOptions, list)
  .command('set-provider <url> [provider]', 'Set the URL of your storage provider.', addServiceOptions, setService)
  .command('get-provider [provider]', 'Get the URL of your storage provider.', addServiceOptions, getService)
  .command('list-providers', 'Get the list of providers and their names', noOptions, getProviders)
  .command('unset-provider [provider]', 'Reset your storage provider to the default: http://localhost:3472', addServiceOptions, unsetService)
  .command('login <username> [provider] [password]', 'Logs you into your storage provider.', addServiceOptions, login)
  .command('logout', 'Logs you out of your storage provider.', addServiceOptions, logout)
  .command('run-service', 'Runs a local storage provider.', addClientOptions, runService)
  .command('migrate', 'Migrates old dat-store data to new format', noOptions, migrate)
  .help()

module.exports = (argv) => {
  commands.parse(argv)
}

function getClient (args) {
  const PeerClient = require('./client')

  const client = new PeerClient(args)

  return client
}

async function add (args) {
  await getClient(args).add(args.url)
}

async function list (args) {
  const { items } = await getClient(args).list()

  for (let { url, name, title } of items) {
    let line = url
    if (name || title) {
      line = `${url} - ${name || title}`
    }
    console.log(line)
  }
}

async function remove (args) {
  await getClient(args).remove(args.url)
}

async function setService (args) {
  await getClient(args).setService(args.url)
}

async function unsetService (args) {
  await getClient(args).unsetService()
}

async function getService (args) {
  const service = await getClient(args).getService()

  console.log(service)
}

async function login (args) {
  const { username, password } = args

  const client = await getClient(args)

  if (!password) {
    const read = require('read')

    read({ prompt: 'Enter your password:', silent: true }, (err, password) => {
      if (err) throw err
      client.login(username, password)
    })
  } else client.login(username, password)
}

async function logout (args) {
  await getClient(args).logout()
}

function runService () {
  require('./service.js')
}

function migrate () {
  require('./migrate')()
}

async function getProviders (args) {
  const client = await getClient(args)

  const service = await client.getService()

  console.log('[default]', '-', service)

  const providers = await client.getProviders()

  for (let name of Object.keys(providers)) {
    console.log(name, '-', providers[name])
  }
}
