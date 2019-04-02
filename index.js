const yargs = require('yargs')

const SERVICE_NAME = 'dat-store'

const commands = yargs
  .scriptName(SERVICE_NAME)
  .command(['add <url>', '$0 <url>'], 'Add a Dat to your storage provider.', () => void 0, add)
  .command('remove <url>', 'Remove a Dat from your storage provider.', () => void 0, remove)
  .command('list', 'List the Dats in your storage provider.', () => void 0, list)
  .command('set-provider <url>', 'Set the URL of your storage provider.', () => void 0, setService)
  .command('get-provider', 'Get the URL of your storage provider.', () => void 0, getService)
  .command('unset-provider', 'Reset your storage provider to the default: http://localhost:3472', () => void 0, unsetService)
  .command('login <username> [password]', 'Logs you into your storage provider.', () => void 0, login)
  .command('logout', 'Logs you out of your storage provider.', () => void 0, logout)
  .command('run-service', 'Runs a local storage provider.', (yargs) => {
    yargs
      .option('storage-location')
  }, runService)
  .command('install-service', 'Installs a storage service on your machine. This will run in the background while your computer is active.', (yargs) => {
    yargs
      .option('storage-location')
  }, installService)
  .command('uninstall-service', 'Uninstalls your local storage service.', () => void 0, uninstallService)
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

  for (let { url } of items) {
    console.log(url)
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

function getServiceLocation () {
  const path = require('path')
  return path.join(__dirname, 'service.js')
}

function runService () {
  require('./service.js')
}

async function installService (args) {
  const service = require('os-service')
  const programPath = getServiceLocation()

  const programArgs = []

  if (args.storageLocation) {
    programArgs.push('--storage-location', args.storageLocation)
  }

  service.add(SERVICE_NAME, { programPath, programArgs }, (e) => {
    if (e) throw e
  })
}

async function uninstallService (args) {
  const service = require('os-service')

  service.remove(SERVICE_NAME, (e) => {
    if (e) throw e
  })
}
