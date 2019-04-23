const util = require('util')
const path = require('path')
const fs = require('fs-extra')
const Conf = require('conf')
const DatEncoding = require('dat-encoding')
const { DatPinningServiceClient } = require('dat-pinning-service-client')

const debug = require('debug')('dat-store:client')

// URL for storage provider running on localhost
const LOCAL_SERVICE = 'http://localhost:3472'

const ERROR_NO_SERVICE = (service) => `Could not connect to service ${service}
Make sure you have a local service running with 'dat store install-service'
Also check if the remote service you have configured is online`
const ERROR_NO_PROVIDER = (provider) => `Provider URL not set for ${provider}`
const ERROR_NOT_DAT_DIRECTORY = (path) => `No Dat information found in ${path}`

module.exports =

class StoreClient {
  constructor ({ configLocation, provider }) {
    const options = {
      projectName: 'dat-store'
    }

    this.provider = provider

    if (configLocation) {
      options.cwd = configLocation
    }

    this.config = new Conf(options)
  }

  async updateConfig (data) {
    this.config.set(data)
  }

  async ensureInit () {
    if (this.initialized) return
    await this.init()
    this.initialized = true
  }

  async resolveURL (url) {
    try {
      const key = DatEncoding.decode(url)
      return `dat://` + DatEncoding.encode(key)
    } catch (e) {
      // Probably a DNS based Dat URL
      if (url.startsWith('dat://')) {
        return url
      }
      // Probably a folder path
      const cwd = process.cwd()
      const fullPath = path.resolve(cwd, url)
      const keyLocation = path.resolve(fullPath, './.dat/metadata.key')
      try {
        const key = await fs.readFile(keyLocation)
        return `dat://` + DatEncoding.encode(key)
      } catch (e) {
        try {
          const rawLocation = path.resolve(fullPath, './metadata.key')
          const key = await fs.readFile(rawLocation)
          return `dat://` + DatEncoding.encode(key)
        } catch (e) {
          throw new Error(ERROR_NOT_DAT_DIRECTORY(url))
        }
      }
    }
  }

  async getProviders () {
    return this.getConfig('providers', {})
  }

  async setProvider (provider, url) {
    const providers = await this.getProviders()

    const newProviders = Object.assign({}, providers, {
      [provider]: url
    })

    await this.setConfig('providers', newProviders)
  }

  async getProviderURL (provider) {
    const providers = await this.getProviders()

    const url = providers[provider]

    if (!url) throw new Error(ERROR_NO_PROVIDER(provider))

    return url
  }

  async getService () {
    if (this.provider) {
      return this.getProviderURL(this.provider)
    } else {
      return this.getConfig('service', LOCAL_SERVICE)
    }
  }

  async setService (service) {
    if (this.provider) {
      return this.setProvider(this.provider, service)
    } else {
      await this.setConfig('service', service)
    }
  }

  async unsetService () {
    await this.setService(LOCAL_SERVICE)
  }

  async getToken () {
    return this.getConfig('token', null)
  }

  async setToken (token) {
    await this.setConfig('token', token)
  }

  async init () {
    const service = await this.getService()
    this.client = new DatPinningServiceClient(service)
    try {
      await this.callClient('fetchPSADoc')
      const token = await this.getToken()
      if (token) {
        this.client.setSession(token)
      }
    } catch (e) {
      debug(e)
    }
    if (!this.client.psaDoc) throw new Error(ERROR_NO_SERVICE(service))
  }

  async callClient (method, ...args) {
    return util.promisify(this.client[method]).call(this.client, ...args)
  }

  async login (username, password) {
    await this.ensureInit()

    await this.callClient('login', username, password)
    const token = this.client.sessionToken

    await this.setToken(token)
  }

  async logout () {
    await this.setToken(null)
  }

  async getConfig (key, defaultValue) {
    return this.config.get(key, defaultValue)
  }

  async setConfig (key, value) {
    this.config.set(key, value)
  }

  async add (url) {
    await this.ensureInit()

    const service = await this.getService()

    // If it's a local service, pass it file paths directly
    if (service !== LOCAL_SERVICE) {
      url = await this.resolveURL(url)
    } else {
      url = path.resolve(process.cwd(), url)
    }

    return this.callClient('addDat', { url })
  }

  async list () {
    await this.ensureInit()

    return this.callClient('listDats')
  }

  async remove (url) {
    await this.ensureInit()

    const service = await this.getService()

    // If it's a local service, pass it file paths directly
    if (service !== LOCAL_SERVICE) {
      url = await this.resolveURL(url)
    } else {
      url = path.resolve(process.cwd(), url)
    }

    return this.callClient('removeDat', url)
  }
}
