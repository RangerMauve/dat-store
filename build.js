const args = require('yargs')
  .option('target')
  .demandOption('target')
  .parse(process.argv.slice(2))

const OUTPUT_MAP = {
  linux: './dist/hyper-gateway-linux',
  darwin: './dist/hyper-gateway-macos',
  win32: './dist/hyper-gateway-windows.exe'
}

const packageData = require('./package.json')

const { target } = args
const targetKey = `pkg-${target}`

const pkgConfig = packageData[targetKey]

if (!pkgConfig) throw new Error(`Invalid target, must supply ${targetKey} in the package.json`)

packageData.pkg = pkgConfig

console.log('Preparing package.json')

require('fs').writeFileSync('./package.json', JSON.stringify(packageData, null, '  '))

console.log('Rebuilding dependencies for', target)

require('child_process').execSync(`npm i --target_arch=x64 --target_platform=${target}`, { stdio: ['pipe', 'pipe', 'pipe'] })

const outputName = OUTPUT_MAP[target] || pkgConfig.output

if (!outputName) throw new Error('Must specify appropriate output name in config')

console.log('Compiling, output to', outputName)

require('child_process').execSync(`pkg ./ --output ${outputName} --compress Brotli`, { stdio: ['pipe', 'pipe', 'pipe'] })

console.log('Cleaning package.json')

delete packageData.pkg

require('fs').writeFileSync('./package.json', JSON.stringify(packageData, null, '  '))

console.log('Done!')
