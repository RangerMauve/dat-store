const fs = require('fs-extra')
const path = require('path')
const DatEncoding = require('dat-encoding')
const watch = require('recursive-watch')
const datignore = require('@beaker/datignore')
const anymatch = require('anymatch')
const dft = require('diff-file-tree')
const slugify = require('@sindresorhus/slugify')

const SDK = require('hyper-sdk')

const ERROR_NOT_FOUND_URL = (url) => `URL Not Found ${url}`
const ERROR_NOT_FOUND_FOLDER = (path) => `Folder Not Found ${path}`
const ERROR_LOADING_DIRECTORY = (path, e) => `Could not load folder ${path}:${e.message}`
const ERROR_DNS_ISSUE = (key, e) => `Unable to resolve DNS for ${key}, ${e.message}`

const DNS_ERRORS = [
  'DNS record not found',
  'Domain is not a FQDN.',
  'Invalid dns-over-https record, must provide json',
  'Invalid dns-over-https record, no TXT answers given',
  'Invalid dns-over-https record, no TXT answer given'
]

module.exports =

class Library {
  static async create (opts = {}) {
    const { storageLocation, p2pPort } = opts
    const sdk = await SDK({
      storage: storageLocation,
      swarmOpts: {
        ephemeral: false,
        preferredPort: p2pPort
      }
    })

    return new Library({ ...opts, sdk })
  }

  constructor ({ storageLocation, datPort, latest = false, sdk }) {
    const { Hyperdrive, resolveName, close } = sdk

    this.Hyperdrive = Hyperdrive
    this.resolveName = resolveName
    this.closeSDK = close

    this.urls = new Map()
    this.folders = new Map()
    this.cores = new Map()

    this.latest = latest
    this.storageLocation = storageLocation
    this.folderListLocation = path.join(storageLocation, 'folders.json')
    this.urlListLocation = path.join(storageLocation, 'urls.json')
    this.coresListLocation = path.join(storageLocation, 'cores.json')
  }

  async list () {
    return [...this.urls.keys(), ...this.folders.keys()]
  }

  get archives () {
    return [...this.urls.values(), ...this.folders.values()]
  }

  async resolve (url) {
    return await this.resolveName(url)
  }

  async get (url) {
    const entries = [...this.urls.entries(), ...this.folders.entries()]

    for (const [key, archive] of entries) {
      if (key === url) return archive
      const archiveURL = 'hyper://' + DatEncoding.encode(archive.key)
      if (archiveURL === url) return archive
    }
  }

  async addURL (url) {
    if (this.urls.has(url)) {
      const archive = this.urls.get(url)
      await archive.ready()
      return archive
    }

    const resolved = 'hyper://' + await this.resolveName(url)
    const key = DatEncoding.decode(resolved)
    const archive = this.Hyperdrive(key, {
      sparse: this.latest,
      sparseMetadata: this.latest
    })

    this.urls.set(url, archive)

    await archive.ready()

    await this.saveUrls()

    // Start downloading
    archive.download('/')

    // TODO: Account for mounts
    const watcher = archive.watch('/', () => {
      archive.download('/')
    })

    archive.destroyMirror = () => {
      watcher.destroy()
    }

    return archive
  }

  async unloadArchive (archive, shouldDelete) {
    if (archive.destroyMirror) archive.destroyMirror()

    await archive.destroyStorage()
  }

  async removeURL (url) {
    const archive = this.urls.get(url)

    if (!archive) return

    await this.unloadURL(url, true)

    await this.saveUrls()
  }

  async unloadURL (url, shouldDelete) {
    const archive = this.urls.get(url)
    if (!archive) throw new Error(ERROR_NOT_FOUND_URL(url))

    await this.unloadArchive(archive, shouldDelete)

    this.urls.delete(url)
  }

  async addFolder (folder) {
    if (this.folders.has(folder)) {
      const archive = this.folders.get(folder)

      await archive.ready()

      return archive
    }

    const opts = {
      sparse: this.latest,
      sparseMetadata: this.latest
    }

    const dotDatLocation = path.join(folder, '.dat')
    const hasDotDat = await fs.pathExists(dotDatLocation)

    // If the folder hasn't been registerd as an archive
    // Make up a unique name and use it as a Hyperdrive namespace
    if (!hasDotDat) {
      const drivename = slugify(folder)
      await fs.writeFile(dotDatLocation, drivename, 'utf8')
    }

    // Read the `.dat` file, which should have a url or key
    let key = await fs.readFile(dotDatLocation, 'utf8')

    // Only try to resolve URLs
    if (key.startsWith('hyper://')) {
      try {
        const resolved = 'hyper://' + await this.resolveName(key)
        key = DatEncoding.decode(resolved)
      } catch (e) {
        for (const known of DNS_ERRORS) {
          if (e.message.startsWith(known)) throw new Error(ERROR_DNS_ISSUE(key, e))
        }
        // Must not be a DNS issue, so it's probably a named archive?
      }
    }

    // Open the hyperdrive
    const archive = this.Hyperdrive(key, opts)

    this.folders.set(folder, archive)

    await archive.ready()

    await this.saveFolders()

    if (archive.writable) {
      const syncFolder = async () => {
        try {
          // Try reading the .datignore file
          const datignoreData = await fs.readFile(path.join(folder, '.datignore'), 'utf8').catch(() => '')
          const ignore = datignore.toAnymatchRules(datignoreData)
          const filter = anymatch(ignore)

          const source = folder
          const dest = { fs: archive, path: '/' }

          const diff = await dft.diff(source, dest, {
            filter
          })
          await dft.applyRight(source, dest, diff)
        } catch (e) {
        // Whatever
        }
      }

      // Mirror from the folder files to the archive
      await syncFolder()

      archive.destroyMirror = watch(folder, syncFolder)
    } else {
      const syncFolder = async () => {
        try {
        // Try reading the .datignore file
          const datignoreData = await archive.readFile('.datignore', 'utf8').catch(() => '')
          const ignore = datignore.toAnymatchRules(datignoreData)
          const filter = anymatch(ignore)

          const source = { fs: archive, path: '/' }
          const dest = folder

          const diff = await dft.diff(source, dest, {
            filter
          })

          await dft.applyRight(source, dest, diff)
        } catch (e) {
        // Whatever
        }
      }

      // Mirror from the archive to the folder
      await syncFolder()

      // Watch for changes in the hypertrie
      const watcher = archive.watch('/', syncFolder)

      archive.destroyMirror = () => {
        watcher.destroy()
      }
    }

    return archive
  }

  async removeFolder (path) {
    await this.unloadFolder(path, true)

    await this.saveFolders()
  }

  async unloadFolder (path, shouldDelete) {
    const archive = this.folders.get(path)
    if (!archive) throw new Error(ERROR_NOT_FOUND_FOLDER(path))

    await this.unloadArchive(archive, shouldDelete)

    this.folders.delete(path)
  }

  async loadURLS () {
    let urls = []
    try {
      urls = await fs.readJSON(this.urlListLocation)
    } catch (e) {
      // No folder file present
    }

    if (!urls || !Array.isArray(urls) || !urls.length) return

    await Promise.all(urls.map(async (url) => {
      try {
        await this.addURL(url)
      } catch (e) {
        console.error(ERROR_NOT_FOUND_URL(url, e))
      }
    }))
  }

  async loadFolders () {
    let folders = []
    try {
      folders = await fs.readJSON(this.folderListLocation)
    } catch (e) {
      // No folder file present
    }

    if (!folders || !Array.isArray(folders)) return

    await Promise.all(folders.map(async (path) => {
      try {
        await this.addFolder(path)
      } catch (e) {
        console.error(ERROR_LOADING_DIRECTORY(path, e))
      }
    }))
  }

  async saveFolders () {
    const folders = [...this.folders.keys()]

    await fs.ensureDir(this.storageLocation)

    await fs.writeJSON(this.folderListLocation, folders)
  }

  async saveUrls () {
    const urls = [...this.urls.keys()]

    await fs.ensureDir(this.storageLocation)

    await fs.writeJSON(this.urlListLocation, urls)
  }

  async load () {
    await this.loadURLS()
    await this.loadFolders()
  }

  async close () {
    for (const archive of this.folders.values()) {
      await this.unloadArchive(archive)
    }

    await this.closeSDK()
  }
}
