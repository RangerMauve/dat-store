const fs = require('fs-extra')
const path = require('path')
const DatEncoding = require('dat-encoding')
const pda = require('pauls-dat-api')
const { promisify } = require('util')
const watch = require('recursive-watch')
const datignore = require('@beaker/datignore')
const anymatch = require('anymatch')
const dft = require('diff-file-tree')

const SDK = require('dat-sdk')

const ERROR_NOT_FOUND_URL = (url) => `URL Not Found ${url}`
const ERROR_NOT_FOUND_FOLDER = (path) => `Folder Not Found ${path}`
const ERROR_LOADING_DIRECTORY = (path, e) => `Could not load folder ${path}:${e.message}`

module.exports =

class Library {
  constructor ({ storageLocation, datPort, latest = false }) {
    const { Hyperdrive, resolveName, deleteStorage, destroy } = SDK({
      storageOpts: {
        storageLocation
      },
      swarmOpts: {
        port: datPort,

        // Had issues with tests failing when UTP was enabled
        utp: false
      }
    })

    this.Hyperdrive = Hyperdrive
    this.resolveName = promisify(resolveName)
    this.destroySDK = destroy
    this.deleteStorage = promisify(deleteStorage)

    this.urls = new Map()
    this.folders = new Map()

    this.latest = latest
    this.storageLocation = storageLocation
    this.folderListLocation = path.join(storageLocation, 'folders.json')
    this.urlListLocation = path.join(storageLocation, 'urls.json')
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

    const resolved = `dat://` + await this.resolveName(url)
    const key = DatEncoding.decode(resolved)
    const archive = this.Hyperdrive(key, {
      sparse: this.latest
    })

    this.urls.set(url, archive)

    await awaitFN(archive, 'ready')

    await this.saveUrls()

    return archive
  }

  async unloadArchive (archive) {
    if (archive.destroyMirror) archive.destroyMirror()

    await awaitFN(archive, 'close')
  }

  async removeURL (url) {
    const archive = this.urls.get(url)

    if (!archive) return

    await this.unloadURL(url)

    await this.deleteStorage(archive.key)

    await this.saveUrls()
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

    const opts = {
      sparse: this.latest
    }

    const dotDatLocation = path.join(folder, `.dat`)
    let hasDotDat = await fs.pathExists(dotDatLocation)

    if (hasDotDat) {
      const stat = await fs.stat(dotDatLocation)
      opts.latest = this.latest || stat.isDirectory()
    }

    const archive = this.Hyperdrive(folder, opts)

    this.folders.set(folder, archive)

    await awaitFN(archive, 'ready')

    await this.saveFolders()

    // Double check if a `.dat` has been added after loading
    // This happens when a fresh folder is added to the SDK
    if (!hasDotDat) {
      hasDotDat = await fs.pathExists(dotDatLocation)
    }

    // If there's no `.dat` file or folder, don't try to watch for changes
    if (!hasDotDat) return archive

    if (archive.writable) {
      const syncFolder = async () => {
        try {
        // Try reading the .datignore file
          const datignoreData = await fs.readFile(path.join(folder, '.datignore'), 'utf8').catch(() => '')
          const ignore = datignore.toAnymatchRules(datignoreData)
          const filter = anymatch(ignore)

          const source = folder
          const dest = {fs: archive, path: '/'}

          const diff = await dft.diff(source, dest, {
            filter
          })

          await dft.applyRight(source, dest)

          await pda.exportFilesystemToArchive({
            srcPath: folder,
            dstArchive: archive,
            ignore
          })
        } catch (e) {
        // Whatever
        }
      }

      // Mirror from the folder files to the archive
      syncFolder()

      archive.destroyMirror = watch(folder, syncFolder)
    } else {
      const syncFolder = async () => {
        try {
        // Try reading the .datignore file
          const datignoreData = await pda.readFile(archive, '.datignore', 'utf8').catch(() => '')
          const ignore = datignore.toAnymatchRules(datignoreData)
          const filter = anymatch(ignore)

          const source = {fs: archive, path: '/'}
          const dest = folder

          const diff = await dft.diff(source, dest, {
            filter
          })

          await dft.applyRight(source, dest)

          await pda.exportFilesystemToArchive({
            srcPath: folder,
            dstArchive: archive,
            ignore
          })
        } catch (e) {
        // Whatever
        }
      }

      // Mirror from the archive to the folder
      syncFolder()

      // watch for changes in the archive
      const events = pda.watch(archive)

      events.on('data', syncFolder)

      archive.destroyMirror = () => {
        events.emit('close')
      }
    }

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
    for (let archive of this.folders.values()) {
      await this.unloadArchive(archive)
    }

    await new Promise((resolve, reject) => {
      this.destroySDK((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
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
