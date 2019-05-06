const raf = require('random-access-file')
const path = require('path')
const secretStorage = require('dat-secret-storage')

// Taken from dat-node https://github.com/datproject/dat-node/blob/master/lib/storage.js#L31
module.exports = (storage) => {
  return {
    metadata: function (name, opts) {
      // I don't think we want this, we may get multiple 'ogd' sources
      if (name === 'secret_key') return secretStorage()(path.join(storage, 'metadata.ogd'), { key: opts.key, discoveryKey: opts.discoveryKey })
      return raf(path.join(storage, 'metadata.' + name))
    },
    content: function (name, opts) {
      return raf(path.join(storage, 'content.' + name))
    }
  }
}
