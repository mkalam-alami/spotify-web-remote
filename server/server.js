const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const envfile = require('envfile');
const SpotifyWebApi = require('spotify-web-api-node');

const queue = require('./queue');

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

function playNextInQueue() {
    const nextUri = queue.nextUri();
    if (nextUri) {
        await spotifyApi.play({ uris: [nextUri] });
    }
}

const app = express();

/**
 * Get the current playing song information
 */
app.get('/api/currentSong', async function (req, res, next) {
    assertSpotifyAuthenticated(res);
    try {
        const currentState = await spotifyApi.getMyCurrentPlayingTrack()
        if (!currentState.body.progress_ms
            && !currentState.body.is_playing
            && currentState.body.item.uri === app.locals.currentPlayingUri) {
            playNextInQueue();
        } else if (currentState.body.is_playing) {
            app.locals.currentPlayingUri = currentState.body.item.uri;
        }

        currentState.body.queue = queue.tracks;
        res.send(currentState);
    } catch (err) {
        console.log(err);
        refresh(function () {
            res.redirect('/api/currentSong');
        });
    }
});

/**
 * Control the playback, pause, play, prev, next
 */
app.get('/api/control/:control', function (req, res, next) {
    assertSpotifyAuthenticated(res);
    var prom = Promise.resolve('ok');
    switch (req.params.control) {
        case 'pause':
            prom = spotifyApi.pause();
            console.log('pause');
            break;
        case 'play':
            prom = spotifyApi.play();
            console.log('play');
            break;
        case 'prev':
            prom = spotifyApi.skipToPrevious();
            console.log('previous');
            break;
        case 'next':
            if (queue.tracks.length > 0) {
                playNextInQueue();
            } else {
                prom = spotifyApi.skipToNext();
            }
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
    spotifyApi.search(req.params.q, ['artist', 'track'])
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
        } catch (err) {
            console.error(err);
            res.redirect('/');
        }
    } else {
        console.log('Redirecting to Spotify for authorization')
        res.redirect(spotifyApi.createAuthorizeURL(['app-remote-control', 'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing']));
    }
});

app.post('/api/queue/:uri', async function (req, res, next) {
    try {
        const trackId = req.params.uri.replace('spotify:track:', '');
        assertSpotifyAuthenticated(res);
        const trackInfo = await spotifyApi.getTrack(trackId);
        if (trackInfo) {
            const artist = trackInfo.body.artists.map(artistInfo => artistInfo.name).join(', ');
            console.log(`Adding track ${artist} - ${trackInfo.body.name} to queue`);
            queue.append(trackInfo.body.uri, trackInfo.body.name, artist);
        }
        res.send({});
        res.end();
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
});
app.delete('/api/queue/:uri', async function (req, res, next) {
    queue.delete(req.params.uri)
    res.send({});
    res.end();
});
app.post('/api/queue/move-down/:uri', async function (req, res, next) {
    queue.moveDown(req.params.uri)
    res.send({});
    res.end();
});
app.post('/api/queue/move-up/:uri', async function (req, res, next) {
    queue.moveUp(req.params.uri)
    res.send({});
    res.end();
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
