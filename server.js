const createFastify = require('fastify')
const pda = require('pauls-dat-api')
const DSS = require('discovery-swarm-stream/server')
const DAT_SWARM_DEFAULTS = require('dat-swarm-defaults')
const envPaths = require('env-paths')

const Library = require('./library')

const DEFAULT_STORAGE_LOCATION = envPaths('dat-store').data
const DEFAULT_PORT = 3472
const DEFAULT_HOST = '::'

const ERROR_NOT_LOCAL = (path, ip) => `Cannot Add File Path From Remote IP ${path}, ${ip}`

module.exports =

class StoreServer {
  static async createServer (options) {
    const server = new StoreServer()

    await server.init(options)

    return server
  }

  async init ({ port, host, storageLocation, verbose = true, datPort = 3282, latest = false }) {
    storageLocation = storageLocation || DEFAULT_STORAGE_LOCATION

    this.library = new Library({
      storageLocation, datPort, latest
    })

    this.dir = storageLocation

    this.fastify = createFastify({ logger: verbose })

    const swarmOpts = DAT_SWARM_DEFAULTS({
      hash: false
    })

    this.dss = new DSS(swarmOpts)

    await this.library.load()

    this.initRoutes()

    const handle = (conn) => this.dss.addClient(conn)

    this.fastify.register(require('fastify-websocket'), { handle })

    await this.fastify.listen(
      port || DEFAULT_PORT,
      host || DEFAULT_HOST
    )
  }

  initRoutes () {
    this.fastify.get('/.well-known/psa', async () => {
      return {
        'PSA': 1,
        'title': 'My ',
        'description': 'Keep your Dats online!',
        'links': [{
          'rel': 'https://archive.org/services/purl/purl/datprotocol/spec/pinning-service-account-api',
          'title': 'User accounts API',
          'href': '/v1/accounts'
        }, {
          'rel': 'https://archive.org/services/purl/purl/datprotocol/spec/pinning-service-dats-api',
          'title': 'Dat pinning API',
          'href': '/v1/dats'
        }]
      }
    })

    this.fastify.post('/v1/accounts/login', async () => {
      return {
        sessionToken: 'null'
      }
    })

    this.fastify.post('/v1/accounts/logout', async () => {
      return {}
    })

    this.fastify.get('/v1/accounts/account', async () => {
      return {
        username: 'Localhost'
      }
    })

    this.fastify.get('/v1/dats/', async () => {
      const keys = await this.library.list()

      const items = []

      for (let key of keys) {
        const metadata = await this.getMetadata(key)

        items.push(metadata)
      }

      return {
        items
      }
    })

    this.fastify.post('/v1/dats/add', async ({ body, ip }) => {
      const { url } = body

      if (url.startsWith('dat://')) {
        await this.library.addURL(url)
      } else {
        if (!ip.endsWith('127.0.0.1')) { throw new Error(ERROR_NOT_LOCAL(url, ip)) }
        await this.library.addFolder(url)
      }
      return {}
    })

    this.fastify.post('/v1/dats/remove', async ({ body, ip }) => {
      try {
        const { url } = body

        if (url.startsWith('dat://')) {
          await this.library.removeURL(url)
        } else {
          if (!ip.endsWith('127.0.0.1')) { throw new Error(ERROR_NOT_LOCAL(url, ip)) }
          await this.library.removeFolder(url)
        }
      } catch (e) { console.error(e) }

      return {}
    })

    this.fastify.get('/v1/dats/item/:key', async ({ params }) => {
      const { key } = params

      return this.getMetadata(key)
    })

    this.fastify.post('/v1/dats/item/:key', async () => {
      return {}
    })
  }

  async getMetadata (key) {
    const archive = await this.library.get(key)

    let manifest = {
      name: key
    }
    try {
      manifest = await pda.readManifest(archive)
    } catch (e) {
      // It must not have a manifest, that's okay
    }

    return {
      url: `dat://${archive.key.toString('hex')}`,
      name: manifest.name,
      title: manifest.title,
      description: manifest.description,
      additionalUrls: []
    }
  }

  async destroy () {
    await new Promise((resolve, reject) => {
      this.fastify.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    await new Promise((resolve, reject) => {
      this.dss.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    await this.library.close()
  }
}
