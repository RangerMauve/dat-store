# dat-pin
An extension for the Dat CLI to support Pinning Services

```shell
npm install -g dat-pin

# Install local pinning service
dat-pin install-service

# Add a dat to the pinning service so it's always being shared
dat-pin add dat://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/
```

## Commands

```
dat-pin [command]

Commands:
  dat-pin add                Pin a `dat://` read key to your pinning service to
                             keep it online
  dat-pin remove             Remove a `dat://` read key from your pinning
                             service
  dat-pin list               List the `dat://` read keys that you've pinned
  dat-pin set-service        Set the URL of the pinning service you want to use
  dat-pin unset-service      Resets your preferences to use your local pinning
                             service
  dat-pin get-service        Get the URL for your pinning service
  dat-pin login              Logs you into the configured pinning service. Not
                             necessary for local services
  dat-pin logout             Logs you out of the pinning service
  dat-pin install-service    Installs a local pinning service on your computer.
                             This will run in the background while your computer
                             is active.
  dat-pin uninstall-service  Uninstalls your local pinning service.
```

## How it works:

- Uses [dat-pinning-service-client](https://github.com/beakerbrowser/dat-pinning-service-client) to talk to pinning services that adhere to [DEP 0003](https://www.datprotocol.com/deps/0003-http-pinning-service-api/)
- Can start a local pinning service called `dat-pin` using `dat-pin install-service` (uses [os-service](https://www.npmjs.com/package/os-service))
- Runs on `127.0.0.1:3472`
- Binds to port `3282` for interacting with the P2P network
- The service uses [dat-librarian](https://www.npmjs.com/package/dat-librarian) to manage archives
- The service acts as a discovery gateway for [discovery-swarm-stream](https://www.npmjs.com/package/discovery-swarm-stream)
