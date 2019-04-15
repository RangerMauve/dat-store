const util = require('util')
const fs = require('fs-extra')

const { DatPinningServiceClient } = require('dat-pinning-service-client')
const userhome = require('userhome')

const debug = require('debug')('dat-store:client')

// Default location for  config
const CONFIG_LOCATION = userhome('.dat', 'store.json')

// URL for storage provider running on localhost
const LOCAL_SERVICE = 'http://localhost:3472'

const ERROR_NO_SERVICE = (service) => `Could not connect to service ${this.service}
Make sure you have a local service running with 'dat store install-service'
Also check if the remote service you have configured is online`

module.exports =

class StoreClient {
  constructor ({ configLocation }) {
    this.configLocation = configLocation || CONFIG_LOCATION
  }

  async getConfig () {
    let config = {
      service: LOCAL_SERVICE,
      token: null
    }
    try {
      const rawConfig = await fs.readFile(this.configLocation, 'utf8')
      config = JSON.parse(rawConfig)
    } catch (e) {
      debug(e)
    }
    return config
  }

  async updateConfig (data) {
    const current = await this.getConfig()
    const final = Object.assign({}, current, data)
    await fs.ensureFile(this.configLocation)
    await fs.writeJSON(this.configLocation, final, { spaces: 2 })
  }

  async ensureInit () {
    if (this.initialized) return
    await this.init()
    this.initialized = true
  }

  async init () {
    this.config = await this.getConfig()
    const { service, token } = this.config
    this.service = service || LOCAL_SERVICE
    this.token = token

    this.client = new DatPinningServiceClient(this.service)
    try {
      await this.callClient('fetchPSADoc')
      if (this.token) {
        this.client.setSession(token)
      }
    } catch (e) {
      debug(e)
    }
  }

  ensureService () {
    if(!this.client.psaDoc) throw new Error(ERROR_NO_SERVICE(this.service))
  }

  async callClient (method, ...args) {
    return util.promisify(this.client[method]).call(this.client, ...args)
  }

  async login (username, password) {
    await this.ensureInit()
    this.ensureService()

    await this.callClient('login', username, password)
    const token = this.client.sessionToken
    await this.updateConfig({
      token
    })
  }

  async logout () {
    await this.ensureInit()
    this.ensureService()

    await this.updateConfig({
      token: null
    })
  }

  async setService (service) {
    await this.ensureInit()

    await this.updateConfig({
      service
    })

    this.service = service
  }

  async unsetService () {
    await this.ensureInit()

    await this.updateConfig({
      service: LOCAL_SERVICE
    })

    this.service = LOCAL_SERVICE
  }

  async getService () {
    await this.ensureInit()
    return this.service
  }

  async add (url) {
    await this.ensureInit()
    this.ensureService()

    return this.callClient('addDat', { url })
  }

  async list () {
    await this.ensureInit()
    this.ensureService()

    return this.callClient('listDats')
  }

  async remove (url) {
    await this.ensureInit()
    this.ensureService()

    return this.callClient('removeDat', url)
  }
}
