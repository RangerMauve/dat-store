const yargs = require('yargs')

const SERVICE_NAME = 'dat-store'
const DEFAULT_LOCAL_SERVICE = 'http://localhost:3472'

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
const addProviderOptions = (yargs) => yargs
  .positional('provider', {
    describe: 'operate on one of multiple, configured providers with this name',
    type: 'string'
  })
const addClientOptions = (yargs) => addProviderOptions(yargs)
  .option('config-location', {
    describe: 'location to store the configuration at, defaults to config directory, see: https://github.com/sindresorhus/env-paths#pathsconfig',
    type: 'string'
  })
  .option('local-service', {
    describe: 'fallback service url for the provider',
    default: DEFAULT_LOCAL_SERVICE,
    type: 'string'
  })
const addClientURLOptions = (yargs) => addClientOptions(yargs)
  .positional('url', {
    describe: 'http URL for the service',
    type: 'string'
  })
const addClientUserOptions = (yargs) => addClientOptions(yargs)
  .positional('username', {
    describe: 'username specified by the remote dat-store',
    type: 'string'
  })
  .positional('password', {
    describe: 'password for the login, will be prompted-for if missing',
    type: 'string'
  })
const addClientURLXOptions = (yargs) => addClientOptions(yargs)
  .positional('url|path', {
    describe: 'Dat URL or folder to find the hyper-drive at'
  })
const addClientURLPathOptions = (yargs) => addClientOptions(yargs)
  .positional('path', {
    describe: 'folder to replicate the Dat to'
  })
  .positional('url', {
    describe: 'Dat URL to replicate'
  })
const noOptions = () => null

const commands = yargs
  .scriptName(SERVICE_NAME)
  .command('add <url|path> [provider]', 'Add a Dat to your storage provider.', addClientURLXOptions, add)
  .command('clone <path> <url> [provider]', 'Sync changes from a Dat into a local folder.', addClientURLPathOptions, clone)
  .command('remove <url|path> [provider]', 'Remove a Dat from your storage provider.', addClientURLXOptions, remove)
  .command('list [provider]', 'List the Dats in your storage provider.', addClientOptions, list)
  .command('set-provider <url> [provider]', 'Set the URL of your storage provider.', addClientURLOptions, setService)
  .command('get-provider [provider]', 'Get the URL of your storage provider.', addClientOptions, getService)
  .command('list-providers', 'Get the list of providers and their names', noOptions, getProviders)
  .command('unset-provider [provider]', `Reset your storage provider to the default: ${DEFAULT_LOCAL_SERVICE}`, addProviderOptions, unsetService)
  .command('login <username> [provider] [password]', 'Logs you into your storage provider.', addClientUserOptions, login)
  .command('logout [provider]', 'Logs you out of your storage provider.', addClientOptions, logout)
  .command('run-service', 'Runs a local storage provider.', addServiceOptions, runService)
  .help()
  .showHelpOnFail(true)

module.exports = (argv) => {
  const parsed = commands.parse(argv)

  if (!parsed._.length){
    commands.showHelp()
  }
}

function getClient (args) {
  const PeerClient = require('./client')

  const client = new PeerClient(args)

  return client
}

async function add (args) {
  await getClient(args).add(args.url)
}

async function clone (args) {
  await getClient(args).clone(args.path, args.url)
}

async function list (args) {
  const { items } = await getClient(args).list()

  for (const { url, title } of items) {
    let line = url
    if (title) {
      line = `${url} - ${title}`
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

function runService (args) {
  const run = require('./service.js')
  run(args)
}

async function getProviders (args) {
  const client = await getClient(args)

  const service = await client.getService()

  console.log('[default]', '-', service)

  const providers = await client.getProviders()

  for (const name of Object.keys(providers)) {
    console.log(name, '-', providers[name])
  }
}
