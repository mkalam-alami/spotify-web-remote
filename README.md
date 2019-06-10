# Spotify Web Remote
This is a web based remote/commander for spotify. It works with the Spotify web api and can be used to control your spotify account. First you'll have to set up the API keys.

# ToDo
- ~Add search~
- Add authentication
- Update deploy script for ReactJS
- Add way to set up authorization with spotify api (getting token etc)
- Add volume control
- Add shuffle/repeat buttons

![Screenshot](/example.png?raw=true "Screen shot")

## Setting up the authorization

- Go to https://developer.spotify.com/dashboard/applications
- Create a client ID and whitelist the URL at which you will serve the app (for development: `http://localhost:3000/`)
- Copy `config.env.default` to `config.env` and set the client ID and secret + your app URL

## Run locally 
- Install node packages, `$ npm install` (in root folder)
- Install client packages (in client folder, `client/app`)
  - Run npm `$ npm install`
  - Run build `$ npm run build`
- Run server (in root folder) `$ npm start`
- Go to `http://localhost:3000` to authorize and start controlling your account

## Deploy
- Copy `ecosystem.json.default` to `ecosystem.json` and set ip-address, username, etc
- Setup deployment `$ pm2 deploy production|development setup` (only the first time)
- Deploy `$ pm2 deploy production|development`