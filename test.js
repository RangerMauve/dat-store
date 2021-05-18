const path = require('path')
const test = require('tape')
const fs = require('fs-extra')
const getPort = require('get-port')
const SDK = require('hyper-sdk')
const delay = require('delay')
const fetch = require('cross-fetch')

const StoreServer = require('./server')
const StoreClient = require('./client')

test('Talk to server with client', async (t) => {
  try {
    const port = await getPort()
    const localService = `http://localhost:${port}`

    const tmpFolder = require('tmp').dirSync({
      prefix: 'dat-store-'
    }).name

    const configLocation = path.join(tmpFolder, 'config')
    const storageLocation = path.join(tmpFolder, 'storage')
    const hyperdriveLocation = path.join(tmpFolder, 'drive')

    const client = new StoreClient({
      configLocation,
      localService
    })

    const sdk = await SDK({
      persist: false
    })

    t.pass('Initialized client')

    const server = await StoreServer.createServer({
      storageLocation,
      port,
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

    t.equals(await client.getService(), localService, 'Service set to default')

    const provider = 'example'
    const providerURL = 'example-service.com'

    const providerClient = new StoreClient({
      configLocation,
      provider,
      localService
    })

    t.pass('Create a client with provider name')

    await providerClient.setService(providerURL)

    t.pass('Set service with provider')

    const persistedProviderURL = await providerClient.getService()

    t.equals(persistedProviderURL, providerURL, 'Provider service persisted')

    await fs.ensureDir(hyperdriveLocation)
    await fs.writeJSON(path.join(hyperdriveLocation, 'dat.json'), {
      title: 'example'
    })

    await client.add(hyperdriveLocation)

    t.pass('Added archive from folder')

    const { items: localItems } = await client.list()
    const [{ url: localURL }] = localItems

    t.ok(localURL, 'Generated key for archive')

    const folderDrive = sdk.Hyperdrive(localURL)

    await folderDrive.ready()

    await delay(3000)

    const datJSON = await folderDrive.readFile('/dat.json')

    t.ok(datJSON, 'Loaded data from archive')

    await server.destroy()

    t.pass('Destroyed server')

    const newServer = await StoreServer.createServer({
      storageLocation,
      port,
      verbose: false
    })

    t.pass('Able to load server up again')

    const { items: localItems2 } = await client.list()
    const [{ url: localURL2 }] = localItems2

    t.equals(localURL2, localURL, 'Local archive got loaded')

    const exampleFileName = 'example.txt'
    const exampleFileLocation = path.join(hyperdriveLocation, exampleFileName)
    const exampleFileData = 'Hello World'

    await fs.writeFile(exampleFileLocation, exampleFileData)

    // Wait for change to propogate
    await delay(3000)

    const gotExampleData = await folderDrive.readFile(exampleFileName, 'utf8')

    t.deepEqual(gotExampleData, exampleFileData, 'Got updated file from archive')

    const gatewayURL = `${localService}/gateway/${folderDrive.key.toString('hex')}/${exampleFileName}`

    const response = await fetch(gatewayURL)

    t.pass('Able to request data for hyperdrive')

    const fetchText = await response.text()

    t.equal(fetchText, exampleFileData, 'Got data from gateway')

    await client.remove(hyperdriveLocation)

    const { items: localItems3 } = await client.list()

    t.equal(localItems3.length, 0, 'Removed local archive')

    await newServer.destroy()

    t.pass('Destroyed server')

    await fs.remove(tmpFolder)
    await sdk.close()

    t.end()
  } catch (e) {
    console.log(e.stack)
    t.fail(e)
  }
})
