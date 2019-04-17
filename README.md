# dat-store

dat-store aims to solve the question of "How do I make sure my Dat is being shared".

It can be used as an extension for the Dat CLI to add your Dats to "stores" that will keep a copy of your content and keep it online.

```shell
npm install -g dat-store

# Run a store on http://localhost:3282
dat-store run-service

# Add a dat to the dat-store so it's always being shared
dat-store dat://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/

# Install local
dat-store install-service

# Configure external storage provider
dat-store set-provider hashbase https://hashbase.io/
dat-store login hashbase yourusername
dat-store add hashbase dat://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/
```

## Commands

```
dat-store [provider] <url>

Add a Dat to your storage provider.

Commands:
  dat-store add [provider] <url>           Add a Dat to your storage provider.
                                                                       [default]
  dat-store remove [provider] <url>        Remove a Dat from your storage
                                           provider.
  dat-store list [provider]                List the Dats in your storage
                                           provider.
  dat-store set-provider [provider] <url>  Set the URL of your storage provider.
  dat-store get-provider [provider]        Get the URL of your storage provider.
  dat-store unset-provider                 Reset your storage provider to the
                                           default: http://localhost:3472
  dat-store login <username> [password]    Logs you into your storage provider.
  dat-store logout                         Logs you out of your storage
                                           provider.
  dat-store run-service                    Runs a local storage provider.
  dat-store install-service                Installs a storage service on your
                                           machine. This will run in the
                                           background while your computer is
                                           active.
  dat-store uninstall-service              Uninstalls your local storage
                                           service.

Options:
  --version           Show version number                              [boolean]
  --help              Show help                                        [boolean]
  --storage-location  The folder to store dats in
  --port              The port to use for the HTTP API           [default: 3472]
  --host              The hostname to make the HTTP server listen on
  --verbose           Whether the HTTP server should output logs
                                                       [boolean] [default: true]
  --dat-port          The port to listen for P2P connections on  [default: 3282]
  --latest            Whether to download just the latest changes
                                                      [boolean] [default: false]
```

## How it works:

- Uses [dat-pinning-service-client](https://github.com/beakerbrowser/dat-pinning-service-client) to talk to storage providers that adhere to [DEP 0003](https://www.datprotocol.com/deps/0003-http-pinning-service-api/)
- Can start a local  called `dat-store` using `dat-store install-service` (uses [os-service](https://www.npmjs.com/package/os-service))
- Runs on `http://localhost:3472`. Configure port with `--port`, configure hostname / network interface with `--host`.
- Server logs can be turned off using `--verbose false`
- Binds to port `3282` for interacting with the P2P network. This can be configured with the `--dat-port` CLI option.
- The service uses [dat-librarian](https://www.npmjs.com/package/dat-librarian) to manage archives
- The service acts as a discovery gateway for [discovery-swarm-stream](https://www.npmjs.com/package/discovery-swarm-stream)
- Can work with multiple providers at the same time

## Where is stuff stored?

This project makes use of the [env-paths](https://github.com/sindresorhus/env-paths#pathsconfig) module to determine the best place to store data based on the platform.

The config file is stored using the [conf](https://github.com/sindresorhus/conf) module, with the name `dat-store`. You can override the folder it'll be stored in with the `--config-location` flag.

The store service is using the [data](https://github.com/sindresorhus/env-paths#pathsdata) directory, also with the name `dat-store`. You can override the folder the data will be stored at using the `--storage-location` flag. You can configure whether the store keeps track of just the latest changes, or the full history with the `--latest` flag. By default, it will store the entire history.

## How do I deal with multiple stores?

`dat-store` supports multiple remote stores using the optional `provider` CLI argument. Whenever you `add` `remove` or `list`, you can specify a provider argument to tell the CLI which store it should be talking to. Think of providers as being similar to [git remotes](https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes)
