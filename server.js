const createFastify = require('fastify')
const pda = require('pauls-dat-api')
const DSS = require('discovery-swarm-stream/server')
const DAT_SWARM_DEFAULTS = require('dat-swarm-defaults')
const envPaths = require('env-paths')
const tsse = require('tsse')

const Library = require('./library')

const DEFAULT_STORAGE_LOCATION = envPaths('dat-store').data
const DEFAULT_PORT = 3472
const DEFAULT_HOST = 'localhost'
const DEFAULT_ANY_HOST = '::'

const ERROR_NOT_LOCAL = (path, ip) => `Cannot Add File Path From Remote IP ${path}, ${ip}`
const ERROR_INVALID_CREDENTIALS = 'Please supply valid username and password credentials'

module.exports =

class StoreServer {
  static async createServer (options) {
    const server = new StoreServer()

    await server.init(options)

    return server
  }

  async init ({
    port,
    host,
    storageLocation,
    verbose = true,
    datPort = 3282,
    latest = false,
    allowCors = false,
    exposeToInternet = false,
    authenticationUsername = '',
    authenticationPassword = '',
    manifestTimeout
  }) {
    storageLocation = storageLocation || DEFAULT_STORAGE_LOCATION

    this.library = new Library({
      storageLocation, datPort, latest
    })

    this.dir = storageLocation

    this.authenticationUsername = authenticationUsername
    this.authenticationPassword = authenticationPassword
    this.manifestTimeout = manifestTimeout

    this.fastify = createFastify({ logger: verbose })

    // Enable websites to make requests to the store from any origin
    if (allowCors) {
      this.fastify.register(require('fastify-cors'), {
        origin: '*',
        methods: ['GET', 'PUT', 'POST']
      })
    }

    // Listen on _all_ network interfaces
    if (exposeToInternet) {
      host = DEFAULT_ANY_HOST
    }

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

  checkAuth (request) {
    const expectedAuth = this.authenticationUsername + this.authenticationPassword
    if (expectedAuth) {
      const authHeader = request.headers.authorization
      const gotAuth = authHeader.slice('Bearer '.length)
      if (!tsse(gotAuth, expectedAuth)) {
        throw new Error(ERROR_INVALID_CREDENTIALS)
      }
    }
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

    this.fastify.post('/v1/accounts/login', async ({ body = {} }) => {
      if (this.authenticationPassword && !tsse(body.password || '', this.authenticationPassword)) {
        throw new Error(ERROR_INVALID_CREDENTIALS)
      }
      if (this.authenticationUsername && !tsse(body.username || '', this.authenticationUsername)) {
        throw new Error(ERROR_INVALID_CREDENTIALS)
      }

      const sessionToken = this.authenticationUsername + this.authenticationPassword

      return {
        sessionToken
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

    this.fastify.get('/v1/dats/', async (request) => {
      this.checkAuth(request)

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

    this.fastify.post('/v1/dats/add', async (request) => {
      this.checkAuth(request)

      const { body, ip } = request

      const { url } = body

      if (url.startsWith('dat://')) {
        await this.library.addURL(url)
      } else {
        if (!ip.endsWith('127.0.0.1')) { throw new Error(ERROR_NOT_LOCAL(url, ip)) }
        await this.library.addFolder(url)
      }
      return {}
    })

    this.fastify.post('/v1/dats/remove', async (request) => {
      this.checkAuth(request)

      const { body, ip } = request

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

    this.fastify.get('/v1/dats/item/:key', async (request) => {
      this.checkAuth(request)

      const { params } = request
      const { key } = params

      return this.getMetadata(key)
    })

    this.fastify.post('/v1/dats/item/:key', async (request) => {
      this.checkAuth(request)

      return {}
    })
  }

  async getMetadata (key) {
    const archive = await this.library.get(key)

    let manifest = {
      name: key
    }
    try {
      
      manifest = Promise.race([
        await pda.readManifest(archive),
        delay(manifestTimeout).then(() => manifest) 
      ])

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
