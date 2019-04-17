const os = require('os')
const path = require('path')
const test = require('tape')

const StoreServer = require('./server')
const StoreClient = require('./client')

const LOCAL_SERVICE = 'http://localhost:3472'

test('Talk to server with client', async (t) => {
  try {
    const configLocation = path.join(os.tmpdir(), 'dat-pin-' + Math.random().toString().slice(2, 16))
    const storageLocation = path.join(os.tmpdir(), 'dat-pin-' + Math.random().toString().slice(2, 16))

    const client = new StoreClient({
      configLocation
    })

    t.pass('Initialized client')

    const server = await StoreServer.createServer({
      storageLocation,
      verbose: false
    })

    t.pass('Initialized server')

    await client.login('example', 'example')

    t.pass('Logged in')

    await client.logout()

    t.pass('Logged out')

    const toSet = 'http://weeee'

    await client.setService(toSet)

    t.pass('Set service')

    t.equals(await client.getService(), toSet, 'Service persisted')

    await client.unsetService()

    t.pass('Unset service')

    t.equals(await client.getService(), LOCAL_SERVICE, 'Service set to default')

    const DAT_PROJECT_KEY = 'dat://60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'
    const DAT_PROJECT_DOMAIN = 'dat://datproject.org'

    await client.add(DAT_PROJECT_DOMAIN)

    t.pass('Added archive')

    const { items } = await client.list()
    const [{ url }] = items

    t.equals(url, DAT_PROJECT_KEY, 'Archive got added to list')

    const RAW_KEY = DAT_PROJECT_KEY.slice('dat://'.length)
    const contentPath = path.join(storageLocation, RAW_KEY)

    await client.remove(contentPath)

    t.pass('Removed / Referenced by path')

    const { items: finalItems } = await client.list()

    t.deepEquals(finalItems, [], 'Key got removed')

    const provider = 'example'
    const providerURL = 'example-service.com'

    const providerClient = new StoreClient({
      configLocation,
      provider
    })

    t.pass('Create a client with provider name')

    await providerClient.setService(providerURL)

    t.pass('Set service with provider')

    const persistedProviderURL = await providerClient.getService()

    t.equals(persistedProviderURL, providerURL, 'Provider service persisted')

    await server.destroy()

    t.pass('Destroyed server')

    t.end()
  } catch (e) {
    t.fail(e)
  }
})
