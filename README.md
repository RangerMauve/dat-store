# dat-store

dat-store aims to solve the question of "How do I make sure my Dat is being shared".

It can be used as a CLI to watch for changes in a folder, or to keep a Dat online based on its URL.

You can [download](https://github.com/datproject/dat-store/releases) an executible without needing to set up Node.js from the latest release.

**Note: dat-store uses features from node 10.10.0 so please make sure your version is higher than that.**

```shell
npm install -g dat-store

# Alternately you can download the latest release for your platform:
# https://github.com/datproject/dat-store/releases

# Run a store on http://localhost:3282
dat-store run-service

# Add a dat to the dat-store so it's always being shared
dat-store add hyper://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/

# Add a folder to the dat-store to create a new archive and copy changes from your folder into it.
dat-store add ./example

# Start synchronizing changes in an archive to a local folder
dat-store clone ./example hyper://example.com

# Configure external storage provider
dat-store set-provider https://hashbase.io/ hashbase
dat-store login yourusername hashbase
dat-store add hyper://0a9e202b8055721bd2bc93b3c9bbc03efdbda9cfee91f01a123fdeaadeba303e/ hashbase
```

## How it works:

- Uses [dat-pinning-service-client](https://github.com/beakerbrowser/dat-pinning-service-client) to talk to storage providers that adhere to [DEP 0003](https://www.datprotocol.com/deps/0003-http-pinning-service-api/)
- Can start a local storage provider with `dat-store run-service`
- Runs on `http://localhost:3472`. Configure port with `--port`, configure hostname / network interface with `--host`.
- Server logs can be turned off using `--verbose false`
- Binds to port `3282` for interacting with the P2P network. This can be configured with the `--p2p-port` CLI option.
- The service uses the [Dat SDK](https://www.npmjs.com/package/dat-sdk) to manage archives
- Can work with multiple providers at the same time
- Listens on `/gateway/:key/path` to serve files from your achives.

## FAQ

### Where is stuff stored?

This project makes use of the [env-paths](https://github.com/sindresorhus/env-paths#pathsconfig) module to determine the best place to store data based on the platform.

The config file is stored using the [conf](https://github.com/sindresorhus/conf) module, with the name `dat-store`. You can override the folder it'll be stored in with the `--config-location` flag.

The store service is using the [data](https://github.com/sindresorhus/env-paths#pathsdata) directory, also with the name `dat-store`. You can override the folder the data will be stored at using the `--storage-location` flag. You can configure whether the store keeps track of just the latest changes, or the full history with the `--latest` flag. By default, it will store the entire history.

### How do I deal with multiple stores?

`dat-store` supports multiple remote stores using the optional `provider` CLI argument. Whenever you `add` `remove` or `list`, you can specify a provider argument to tell the CLI which store it should be talking to. Think of providers as being similar to [git remotes](https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes). You can add a provider with the `dat-store set-provider http://example.com/ PROVIDER_NAME_HERE` command.

You can list your currently configured providers with `dat-store list-providers`.

### How do I add a folder?

Depending on where a store is located, there are different ways that it can handle folders.

For locally running stores, you can `add` a folder which will create a `.dat` file with the key of your archive and will begin to sync changes from your folder to the archive.

You can also use the `clone` command with a URL and a folder to create a `.dat` file with the URL of the cloned archive and begin loading changes from the archive into your folder.

For remote stores, it's a little different. Since a remote store is running on a different computer, it doesn't have a way to access your local folder. In that case, dat-store will find the Dat URL from inside the folder and will send it out to the store like it normally would.

These two modes of operation can be combined together. When you create a dat, add it to your local store. Then add the URL to the remote store. This way, when you make a change to the folder, the local store will update the Dat, and the remote store will get the change and spread it to the rest of the network.

### How do I secure my store?

You can require authentication for your dat-store by specifying the `--authorization-username` and `--authorization-password` flags when you run the service.

### How do I remotely control my store from the Internet?

By default `dat-store run-service` will only listen on local connections.

If you want to remotely control your service from the Internet, specify the `--expose-to-internet` flag. This will make the API for adding and removing stores listen on all network interfaces.

This flag is not needed to share or download archives over the Internet, and is only intended for advanced users. You should probably combine this with the authorization flags so that random people don't abuse your store.

#### NGINX Tips

You should also consider putting your store behind NGINX with a letsecrypt certificate so that "Man In the Middle" attacks can't steal your login credentials or dat URLs.

If you use NGINX, make sure your `/etc/nginx/sites-available/your-pinning-server.com` server config file looks something like this. For example, to redirect your traffic of `mydatstore` subdomain to the default port 3472 for `dat-store`:
```shell
server {
  server_name mydatstore.my-pinning-server.com;

  location / {
    proxy_pass http://localhost:3472;
    proxy_set_header    Host            $host;
    proxy_set_header    X-Real-IP       $remote_addr;
    proxy_set_header    X-Forwarded-for $remote_addr;
    port_in_redirect    off;
    proxy_http_version  1.1;
    proxy_set_header    Upgrade         $http_upgrade;
    proxy_set_header    Connection      "Upgrade";
  }

    listen 80;
    listen [::]:80;

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    
    # ... Certbot managed cerificate stuff down here ...#
}
```

The fastify server will take care of the rest of your serving needs for the store.

#### Can I access the files in an archive over HTTP?

Yes, you can send requests to the path `/gateway/:key/path/to/file`.
(e.g. `http://localhost:42069/gateway/94f0...whatever/index.html`)
Only archives that are being tracked by the store will be loadable.
If you want a general purpose gateway, check out fastify-hyperdrive.

You can use NGINX again to serve the contents of an archive as a top level website with something like the following:

```shell
server {
  server_name blog.my-pinning-server.com;

  location / {
    proxy_pass http://localhost:3472/gateway/94f0cab7f60fcc2a711df11c85db5e0594d11e8a3efd04a06f46a3c34d03c418/;
    proxy_set_header    Host            $host;
    proxy_set_header    X-Real-IP       $remote_addr;
    proxy_set_header    X-Forwarded-for $remote_addr;
    port_in_redirect    off;
    proxy_http_version  1.1;
    proxy_set_header    Upgrade         $http_upgrade;
    proxy_set_header    Connection      "Upgrade";
  }

    listen 80;
    listen [::]:80;

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    
    # ... Certbot managed cerificate stuff down here ...#
}
```

### How do I make it run in the background?

#### Linux (SystemD)

```bash
# Paste this into an interactive bash or zsh shell, or save it as a file and run it with sh.

# This will create the service file.
sudo cat << EOF | sudo tee /etc/systemd/system/dat-store.service > /dev/null
[Unit]
Description=Dat storage provider, keeps dats alive in the background.

[Service]
Type=simple
# Check that dat-store is present at this location
# If it's not, replace the path with its location
ExecStart=$(which dat-store) run-service
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

#### Windows (NSSM)

- Download [NSSM](http://nssm.cc/usage)
- Run the GUI with `nssm install dat-store`
- For the `Path` option, navigate to `%USERPROFILE%\AppData\Roaming\npm` and click on `dat-store.bat`
- Set the arguments to `run-service`
- In the `Login` section, have it log in as your account. This is needed so it can have write access to your folders.
- Set the log location for STDOUT and STDERR so you can debug stuff
- Enjoy!

To uninstall it, run `nssm remove "dat-store"`


## Commands

```
dat-store [command]

Commands:
  dat-store add <url|path> [provider]       Add a Dat to your storage provider.
  dat-store clone <path> <url> [provider]   Sync changes from a Dat into a local
                                            folder.
  dat-store remove <url|path> [provider]    Remove a Dat from your storage
                                            provider.
  dat-store list [provider]                 List the Dats in your storage
                                            provider.
  dat-store set-provider <url> [provider]   Set the URL of your storage
                                            provider.
  dat-store get-provider [provider]         Get the URL of your storage
                                            provider.
  dat-store list-providers                  Get the list of providers and their
                                            names
  dat-store unset-provider [provider]       Reset your storage provider to the
                                            default: http://localhost:3472
  dat-store login <username> [provider]     Logs you into your storage provider.
  [password]
  dat-store logout                          Logs you out of your storage
                                            provider.
  dat-store run-service                     Runs a local storage provider.

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```
