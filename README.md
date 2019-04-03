# dat-store
An extension for the Dat CLI to support storage providers

```shell
npm install -g dat-store

# Run a store on http://localhost:3282
dat-store run-service

# Add a dat to the dat-store so it's always being shared
dat-store dat://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/

# Install local
dat-store install-service

# Configure external storage provider
dat-store set-provider https://hashbase.io/
dat-store login yourusername
```

## Commands

```
dat-store <url>

Add a Dat to your storage provider.

Commands:
  dat-store add <url>                    Add a Dat to your storage provider.
                                                                       [default]
  dat-store remove <url>                 Remove a Dat from your storage
                                         provider.
  dat-store list                         List the Dats in your storage provider.
  dat-store set-provider <url>           Set the URL of your storage provider.
  dat-store get-provider                 Get the URL of your storage provider.
  dat-store unset-provider               Reset your storage provider to the
                                         default: http://localhost:3472
  dat-store login <username> [password]  Logs you into your storage provider.
  dat-store logout                       Logs you out of your storage provider.
  dat-store run-service                  Runs a local storage provider.
  dat-store install-service              Installs a storage service on your
                                         machine. This will run in the
                                         background while your computer is
                                         active.
  dat-store uninstall-service            Uninstalls your local storage service.
```

## How it works:

- Uses [dat-pinning-service-client](https://github.com/beakerbrowser/dat-pinning-service-client) to talk to storage providers that adhere to [DEP 0003](https://www.datprotocol.com/deps/0003-http-pinning-service-api/)
- Can start a local  called `dat-store` using `dat-store install-service` (uses [os-service](https://www.npmjs.com/package/os-service))
- Runs on `http://localhost:3472`
- Binds to port `3282` for interacting with the P2P network
- The service uses [dat-librarian](https://www.npmjs.com/package/dat-librarian) to manage archives
- The service acts as a discovery gateway for [discovery-swarm-stream](https://www.npmjs.com/package/discovery-swarm-stream)
