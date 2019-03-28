const DatLibrarian = require('dat-librarian')
const createFastify = require('fastify')
const pda = require('pauls-dat-api')
const userhome = require('userhome')

const STORAGE_LOCATION = userhome('.dat', 'pinning-data')

module.exports =

class PinServer {
  static async createServer (options) {
    const server = new PinServer()

    await server.init(options)

    return server
  }

  async init ({ port, host, storageLocation }) {
    this.librarian = new DatLibrarian({
      dir: storageLocation || STORAGE_LOCATION
    })

    this.fastify = createFastify({ logger: true })

    await this.librarian.load()

    this.initRoutes()

    await this.fastify.listen(port, host)
  }

  initRoutes () {
    this.fastify.get('/.well-known/psa', async () => {
      return {
        'PSA': 1,
        'title': 'My Pinning Service',
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
      const keys = await this.librarian.list()

      const items = []

      for (let key of keys) {
        const metadata = await this.getMetadata(key)

        items.push(metadata)
      }

      return {
        items
      }
    })

    this.fastify.post('/v1/dats/add', async ({ body }) => {
      const { url } = body

      await this.librarian.add(url)

      return {}
    })

    this.fastify.post('/v1/dats/remove', async ({ body }) => {
      const { url } = body

      await this.librarian.remove(url)

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
    const archive = this.librarian.load(key)

    const manifest = await pda.readManifest(archive)

    return {
      url: `dat://${key.toString('hex')}`,
      name: manifest.name,
      title: manifest.title,
      description: manifest.description,
      additionalUrls: []
    }
  }

  async destroy () {

  }
}
