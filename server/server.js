const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const envfile = require('envfile');
const SpotifyWebApi = require('spotify-web-api-node');

dotenv.config({ path: 'config.env' });

/* Initalize the Spotify API */
var spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI,
    refreshToken: process.env.REFRESH_TOKEN
});

function isSpotifyAuthenticated() {
    return !!spotifyApi.getRefreshToken();
}

function assertSpotifyAuthenticated(res) {
    if (!isSpotifyAuthenticated()) {
        res.status(503);
        res.end();
        throw new Error('Spotify not authenticated yet');
    }
}

function saveEnv() {
    fs.writeFileSync('./config.env', envfile.stringifySync({
        CLIENT_ID: process.env.CLIENT_ID,
        CLIENT_SECRET: process.env.CLIENT_SECRET,
        REDIRECT_URI: process.env.REDIRECT_URI,
        REFRESH_TOKEN: spotifyApi.getRefreshToken()
    }));
}

/**
 * Refresh the Spotify access token
 * @param {function} callback - Callback function that gets called when refreshing is done
 */
function refresh(callback) {
    spotifyApi.refreshAccessToken()
    .then(function (data) {
        console.log('The access token has been refreshed');
        
        // Save the access token so that it's used in future calls
        spotifyApi.setAccessToken(data.body['access_token']);
        callback.call();
    }, function (err) {
        console.log('Could not refresh access token', err);
        spotifyApi.setRefreshToken('');
    });
}

const app = express();

/**
 * Get the current playing song information
 */
app.get('/api/currentSong', function (req, res, next) {
    assertSpotifyAuthenticated(res);
    spotifyApi.getMyCurrentPlayingTrack()
    .then(function (data) {
        res.send(data);
        // res.send(200);
    }, function (err) {
        console.log(err);
        refresh(function () {
            res.redirect('/api/currentSong');
        });
    });
});

/**
 * Control the playback, pause, play, prev, next
 */
app.get('/api/control/:control', function (req, res, next) {
    assertSpotifyAuthenticated(res);
    switch (req.params.control) {
        case 'pause':
            var prom = spotifyApi.pause();
            console.log('pause');
            break;
        case 'play':
            var prom = spotifyApi.play();
            console.log('play');
            break;
        case 'prev':
            var prom = spotifyApi.skipToPrevious();
            console.log('previous');
            break;
        case 'next':
            var prom = spotifyApi.skipToNext();
            console.log('next');
            break;
        default:
            console.log('whatever');
            break;
    }
    prom.then(function () {
        res.send({ status: 'ok' })
    }, function (err) {
        console.log(err);
        refresh(function () {
            res.redirect('/api/control/' + req.params.control);
        });
    });
});

app.get('/api/play/:track', async function (req, res, next) {
    assertSpotifyAuthenticated(res);
    spotifyApi.play({ uris: [req.params.track] })
        .then(function () {
            res.send({ status: 'ok' })
        }, function (err) {
            console.log(err)
            res.send(500)
        })
})


app.get('/api/search/:q', function (req, res, next) {
    assertSpotifyAuthenticated(res);
    spotifyApi.search(req.params.q, ['album', 'artist', 'playlist', 'track'])
        .then(function (result) {
            res.send(result)
        }, function (err) {
            console.log(err)
            res.sendStatus(500)
        })
})

app.get('/', async (req, res, next) => {
    if (isSpotifyAuthenticated()) {
        next();
    } else if (req.query.code) {
        try {
            console.log('Received code from spotify, requesting tokens')
            const authResponse = await spotifyApi.authorizationCodeGrant(req.query.code);
            spotifyApi.setAccessToken(authResponse.body.access_token);
            spotifyApi.setRefreshToken(authResponse.body.refresh_token);
            console.log('Tokens received')
            saveEnv();
            res.redirect('/');
        } catch (e) {
            console.error(e);
            res.redirect('/');
        }
    } else {
        console.log('Redirecting to Spotify for authorization')
        res.redirect(spotifyApi.createAuthorizeURL(['app-remote-control','user-read-playback-state','user-modify-playback-state','user-read-currently-playing']));
    }
});

/* The front end */
app.use(express.static(path.join(__dirname, '../client/app/dist/')));

/* Optional: port on which the server listens */
if (typeof (process.env.NODE_PORT) !== 'undefined') {
    port = process.env.NODE_PORT;
} else {
    port = 3000; // Default port
}

/* Start the web server */
app.listen(port, function () {
    console.log('Listening on ' + port);
});

/* Necessary for some proxy configurations */
app.enable('trust proxy');

app.options("/*", function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    res.send(200);
});
