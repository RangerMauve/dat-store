const fs = require('fs-extra')
const path = require('path')
const createDiscovery = require('hyperdiscovery')
const Hyperdrive = require('hyperdrive')
const DatEncoding = require('dat-encoding')
const mirror = require('mirror-folder')
const datIgnore = require('dat-ignore')
const datDns = require('dat-dns')()

const storage = require('./storage')

const ERROR_NOT_FOUND_URL = (url) => `URL Not Found ${url}`
const ERROR_NOT_FOUND_FOLDER = (path) => `Folder Not Found ${path}`
const ERROR_NOT_DAT_DIRECTORY = (path) => `No Dat information found in ${path}`

module.exports =

class Library {
  constructor ({ storageLocation, datPort, latest = false }) {
    this.urls = new Map()
    this.folders = new Map()

    this.latest = latest
    this.storageLocation = storageLocation
    this.folderListLocation = path.join(storageLocation, 'folders.json')

    this.discovery = createDiscovery({
      port: datPort,
      // Had issues with tests failing when UTP was enabled
      utp: false
    })
  }

  replicate (archive) {
    this.discovery.add(archive)
  }

  unreplicate (archive) {
    this.discovery.leave(archive.discoveryKey)
  }

  async list () {
    return [...this.urls.keys(), ...this.folders.keys()]
  }

  get archives () {
    return [...this.urls.values(), ...this.folders.values()]
  }

  async get (url) {
    const entries = [...this.urls.entries(), ...this.folders.entries()]

    for (let [key, archive] of entries) {
      if (key === url) return archive
      const archiveURL = 'dat://' + DatEncoding.encode(archive.key)
      if (archiveURL === url) return archive
    }
  }

  async addURL (url) {
    if (this.urls.has(url)) {
      const archive = this.urls.get(url)
      await awaitFN(archive, 'ready')
      return archive
    }

    const resolved = `dat://` + await datDns.resolveName(url)
    const location = this.getURLLocation(resolved)
    const key = DatEncoding.decode(resolved)
    const archive = new Hyperdrive(storage(location), key)

    this.urls.set(resolved, archive)

    await this.addArchive(archive)

    return archive
  }

  async addArchive (archive) {
    await awaitFN(archive, 'ready')

    this.replicate(archive)
  }

  async unloadArchive (archive) {
    this.unreplicate(archive)

    if (archive.mirror) archive.mirror.destroy()

    await awaitFN(archive, 'close')
  }

  async removeURL (url) {
    const resolved = `dat://` + await datDns.resolveName(url)

    await this.unloadURL(resolved)

    const location = this.getURLLocation(resolved)

    await fs.remove(location)
  }

  async unloadURL (url) {
    const archive = this.urls.get(url)
    if (!archive) throw new Error(ERROR_NOT_FOUND_URL(url))

    await this.unloadArchive(archive)

    this.urls.delete(url)
  }

  async addFolder (folder) {
    if (this.folders.has(folder)) {
      const archive = this.folders.get(folder)
      await awaitFN(archive, 'ready')
      return archive
    }

    let datPath = null
    let hasDotDat = false

    if (await fs.pathExists(path.join(folder, 'metadata.key'))) {
      datPath = folder
    } else if (await fs.pathExists(path.join(folder, '.dat', 'metadata.key'))) {
      datPath = path.join(folder, '.dat')
      hasDotDat = true
    } else {
      throw new Error(ERROR_NOT_DAT_DIRECTORY(folder))
    }

    const archive = new Hyperdrive(storage(datPath))

    this.folders.set(folder, archive)

    await this.addArchive(archive)

    await this.saveFolders()

    // If there's no `.dat` folder, don't try to watch for changes
    if (!hasDotDat) return archive

    // If we can't write to the archive, don't try to watch changes
    if (!archive.writable) return archive

    // Based on dat-node importer
    // https://github.com/datproject/dat-node/blob/master/lib/import-files.js#L9
    const ignore = datIgnore(folder)

    const mirrorFolder = mirror(folder, { name: '/', fs: archive }, {
      watch: true,
      dereference: true,
      count: true,
      ignore
    })

    archive.mirror = mirrorFolder

    return archive
  }

  async removeFolder (path) {
    await this.unloadFolder(path)

    await this.saveFolders()
  }

  async unloadFolder (path) {
    const archive = this.folders.get(path)
    if (!archive) throw new Error(ERROR_NOT_FOUND_FOLDER(path))

    await this.unloadArchive(archive)

    this.folders.delete(path)
  }

  getURLLocation (url) {
    return path.join(this.storageLocation, url.slice('dat://'.length))
  }

  async loadURLS () {
    let stats = []
    try {
      stats = await fs.readdir(this.storageLocation, {
        withFileTypes: true
      })
    } catch (e) {
      // No dats loaded yet
      return
    }

    const datFolders = stats.filter((stat) => stat.isDirectory())

    await Promise.all(datFolders.map(({ name }) => {
      return this.addURL(name)
    }))
  }

  async loadFolders () {
    let folders = []
    try {
      folders = await fs.readJSON(this.folderListLocation)
    } catch (e) {
      // No folder file present
    }

    if(!folders || !Array.isArray(folders)) return

    await Promise.all(folders.map((path) => {
      return this.addFolder(path)
    }))
  }

  async saveFolders () {
    const folders = [...this.folders.keys()]

    await fs.ensureDir(this.storageLocation)

    await fs.writeJSON(this.folderListLocation, folders)
  }

  async load () {
    await this.loadURLS()
    await this.loadFolders()
  }

  async close () {
    await Promise.all([...this.urls.keys()].map((url) => this.unloadURL(url)))
    await Promise.all([...this.folders.keys()].map((folder) => this.unloadFolder(folder)))
    await this.discovery.close()
  }
}

function awaitFN (archive, fnName, ...args) {
  return new Promise((resolve, reject) => {
    const fn = archive[fnName]
    fn.call(archive, ...args, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}
