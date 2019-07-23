# dat-store

dat-store aims to solve the question of "How do I make sure my Dat is being shared".

It can be used as an extension for the Dat CLI to add your Dats to "stores" that will keep a copy of your content and keep it online.

```shell
npm install -g dat-store

# Run a store on http://localhost:3282
dat-store run-service

# Add a dat to the dat-store so it's always being shared
dat-store dat://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/

# Configure external storage provider
dat-store set-provider https://hashbase.io/ hashbase
dat-store login yourusername hashbase
dat-store add dat://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/ hashbase
```

## Commands

```
dat-store <url|path> [provider]

Add a Dat to your storage provider.

Commands:
  dat-store add <url|path> [provider]       Add a Dat to your storage provider.
                                                                       [default]
  dat-store remove <url|path> [provider]    Remove a Dat from your storage
                                            provider.
  dat-store list [provider]                 List the Dats in your storage
                                            provider.
  dat-store set-provider <url> [provider]   Set the URL of your storage
                                            provider.
  dat-store get-provider [provider]         Get the URL of your storage
                                            provider.
  dat-store unset-provider [provider]       Reset your storage provider to the
                                            default: http://localhost:3472
  dat-store login <username> [provider]     Logs you into your storage provider.
  [password]
  dat-store logout                          Logs you out of your storage
                                            provider.
  dat-store run-service                     Runs a local storage provider.
  dat-store install-service                 Installs a storage service on your
                                            machine. This will run in the
                                            background while your computer is
                                            active.
  dat-store uninstall-service               Uninstalls your local storage
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

## How do I add a folder?

Depending on where a store is located, there are different ways that it can handle folders.

For local stores, you when you specify a folder, and you are able to write to it, it'll behave similarly to the [dat share](https://github.com/datproject/dat#sharing-data) command, but instead of needing to have the command running all the time, it'll be handled by the store. The store will load up the dat archive inside your folder, watch for changes, and share them with the rest of the network. If you aren't able to write to the archive, it will behave like the [dat clone](https://github.com/datproject/dat#download-demo) command and will sync changes from a remote dat to your local folder.

For remote stores, it's a little different. Since a remote store is running on a different computer, it doesn't have a way to access your local folder. In that case, dat-store will find the Dat URL from inside the folder and will send it out to the store like it normally would.

These two modes of operation can be combined together. When you create a dat, add it to your local store. Then add the URL to the remote store. This way, when you make a change to the folder, the local store will update the Dat, and the remote store will get the change and spread it to the rest of the network.

## How do I make it run in the background?

### Linux (System D)

```bash
# This will create the service file
sudo cat << EOF > /etc/systemd/system/dat-store.service
[Unit]
Description=Dat storage provider, keeps dats alive in the background.

[Service]
Type=simple
# Check that dat-store is present at this location
# If it's not, replace the path with it's location
ExecStart=/usr/bin/dat-store run-service
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo chmod 644 /etc/systemd/system/dat-store.service

sudo systemctl daemon-reload
sudo systemctl enable dat-store
sudo systemctl start dat-store

sudo systemctl status dat-store
```

### Windows (NSSM)

- Download [NSSM](http://nssm.cc/usage)
- Run the GUI with `nssm install dat-store`
- For the `Path` option, navigate to `%USERPROFILE%\AppData\Roaming\npm` and click on `dat-store.bat`
- Set the arguments to `run-service`
- In the `Login` section, have it log in as your account. This is needed so it can have write access to your folders.
- Set the log location for STDOUT and STDERR so you can debug stuff
- Enjoy!

To uninstall it, run `nssm remove "dat-store"`
