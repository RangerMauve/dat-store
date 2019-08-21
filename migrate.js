const envPaths = require('env-paths')
const fs = require('fs-extra')
const path = require('path')

const STORAGE_LOCATION = envPaths('dat-store').data

module.exports = async function migrate () {
  console.log('migrating...')

  // Load old folder names
  const stats = await fs.readdir(STORAGE_LOCATION, {
    withFileTypes: true
  })

  console.log('loadded existing folders')

  const folders = stats
    .filter((stat) => stat.isDirectory())
    .map(({ name }) => name)
    .filter((folder) => folder.length > 2)

  // Move them to new folder location
  for (let folder of folders) {
    const toMove = path.join(
      STORAGE_LOCATION,
      folder.slice(0, 2),
      folder.slice(2, 4),
      folder)
    const fromMove = path.join(STORAGE_LOCATION, folder)

    console.log('moving', fromMove, toMove)
    await fs.move(fromMove, toMove)
  }

  console.log('reading existing urls')

  const urlListLocation = path.join(STORAGE_LOCATION, 'urls.json')
  let urls = []

  try {
    urls = await fs.readJSON(urlListLocation)
  } catch (e) {
    // Whatever
  }

  if (urls.length) console.log('read urls', urls)

  const newURLS = folders.map((folder) => `dat://${folder}`)

  const finalURLS = [...new Set(urls.concat(newURLS))]

  console.log('writing urls', finalURLS)
  await fs.writeJSON(urlListLocation, finalURLS)
}
