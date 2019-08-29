class Queue {

    constructor() {
        this.tracks = [/**
        {
            uri,
            name,
            artist
        }
        */];
    }

    append(uri, name, artist) {
        this.tracks.push({
            uri,
            name,
            artist
        })
    }

    nextUri() {
        if (this.tracks.length > 0) {
            return this.tracks.splice(0, 1)[0].uri;
        } else {
            return false;
        }
    }

    moveUp(uri) {
        const index = this.tracks.findIndex(track => track.uri === uri)
        if (index > 0) {
            const deleted = this.tracks.splice(index, 1)
            this.tracks.splice(index - 1, 0, deleted[0])
        }
    }

    moveDown(uri) {
        const index = this.tracks.findIndex(track => track.uri === uri)
        if (index !== -1 && index < this.tracks.length - 1) {
            const deleted = this.tracks.splice(index, 1)
            this.tracks.splice(index + 1, 0, deleted[0])
        }
    }

    delete(uri) {
        const index = this.tracks.findIndex(track => track.uri === uri)
        if (index !== -1) {
            this.tracks.splice(index, 1)
        }
    }

}

module.exports = new Queue();
