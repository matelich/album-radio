require([
    '$api/models', '$views/image#Image', '$views/throbber#Throbber'
], function (models, Image, Throbber) {
    "use strict";
    
    //REGION Handle drops, html style
    var drop_box = document.querySelector('#drop_box');

    drop_box.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/html', this.innerHTML);
        e.dataTransfer.effectAllowed = 'copy';
    }, false);

    drop_box.addEventListener('dragenter', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        this.classList.add('over');
    }, false);

    drop_box.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        return false;
    }, false);

    drop_box.addEventListener('dragleave', function (e) {
        e.preventDefault();
        this.classList.remove('over');
    }, false);

    drop_box.addEventListener('drop', function (e) {
        e.preventDefault();
        var drop = models.Playlist.fromURI(e.dataTransfer.getData('text'));
        this.classList.remove('over');
        var success_message = document.createElement('p');
        success_message.innerHTML = 'Playlist successfully dropped: ' + drop.uri;
        this.appendChild(success_message);
        drop.load('owner').done(function (playlist) {
            playlist.owner.load('currentUser').done(function (owner) {
                if (owner.currentUser) {
                    var allowed_message = document.createElement('p');
                    allowed_message.innerHTML = 'You are the owner of this playlist, let\'s get to work!';
                    drop_box.appendChild(allowed_message);
                    localStorage.album_radio_playlist = drop.uri;
                    populateAlbumsBox();
                }
                else {
                    var disallowed_message = document.createElement('p');
                    disallowed_message.innerHTML = 'You are not the owner of this playlist, choose a different one please!';
                    drop_box.appendChild(disallowed_message);
                    localStorage.album_radio_playlist = null;
                }
            });
        });
    }, false);
    

/* Not using this because dropping a playlist just causes that playlist to be loaded
    models.application.addEventListener('dropped', function () {
        console.log('hola!');
        var dropped = models.application.dropped; // it contains the dropped elements
        console.log(dropped.length);
        console.log(JSON.stringify(dropped));
    });
*/
    //ENDREGION drag/drop

    //REGION utility funcs
    function populateAlbumsBox(snapshot, index, last_loaded_uri) {
        console.log("poppy!");
        if (typeof snapshot === "undefined" || !snapshot) {
            console.log("need to get snapshot!");
            var playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);
            playlist.load('tracks').done(function (tracks) {
                playlist.tracks.snapshot(0, 500).done(function (s) {
                    s.loadAll('album').done(function (playlist_tracks) {
                        populateAlbumsBox(playlist_tracks, 0);
                    });
                });
            });
        } else {
            if (index == 0) {
                drop_box.innerHTML = '';
            }
            var throbber = Throbber.forElement(drop_box);
            var albums_array = [];
            var trigger_promise = new models.Promise();
            var joined_promises = null;
            for (var i = 0; i < snapshot.length; i++) {
                var album = snapshot[i].album;
                if (albums_array.indexOf(album) == -1 && (index == 0 || album.uri != last_loaded_uri)) {
                    albums_array.push(album);
                    var load_promise = album.load('name', 'artists');
                    if (joined_promises == null) {
                        joined_promises = models.Promise.join(trigger_promise, load_promise);
                    } else {
                        joined_promises = models.Promise.join(joined_promises, load_promise);
                    }
                }
            }
            trigger_promise.setDone();
            console.log("albums found: " + albums_array.length);
            if (joined_promises) {
                joined_promises.always(function () {
                    var first_album=true;
                    var w=128;
                    var h=128;
                    albums_array.forEach(function (album) {
                        var album_title = album.name + ' by ';
                        var first = true;
                        album.artists.forEach(function (a) { if (!first) { album_title += ', '; } first = false; album_title += a.name; });
                        if(first_album) { 
                           first_album=false; 
                           var image = Image.forAlbum(album, { width: 192, height: 192, title: album_title });
                        } else {
                           var image = Image.forAlbum(album, { width: 64, height: 64, title: album_title });
                        }
                        drop_box.appendChild(image.node);
                    });
                    if (snapshot.length >= 500) {
                        var playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);
                        playlist.load('tracks').done(function (tracks) {
                            playlist.tracks.snapshot(500 * (index + 1), 500).done(function (s) {
                                console.log('load extra songs: ' + s.length);
                                s.loadAll('album').done(function (playlist_tracks) {
                                    populateAlbumsBox(playlist_tracks, index + 1, albums_array[albums_array.length - 1].uri);
                                });
                            });
                        });
                    }
                    throbber.hide();
                });
            }
            else
                throbber.hide();
        }
    }

    function deletePlayed(playlist, snapshot) {
        if (snapshot.toArray()[0] != models.player.track) {
            var reload = (snapshot.toArray()[0].album != models.player.track.album);
            playlist.tracks.remove(snapshot.ref(0)).done(function () {
                console.log('deleted a song');
                if(reload) { populateAlbumsBox(); }
                playlist.tracks.snapshot(0, 1).done(function (sn) { deletePlayed(playlist, sn); });
            });
        }
        else
            console.log('found current song');
    }
    //ENDREGION

    //REGION initial setup
    if (localStorage.album_radio_playlist) {
        var debug_box = document.querySelector('#debugging');
        var debug_message = document.createElement('p');
        debug_message.innerHTML = 'You have a playlist stored in localstorage: ' + localStorage.album_radio_playlist + " - " + new Date().toUTCString();
        debug_box.appendChild(debug_message);
        populateAlbumsBox();
    }
    // find out initial status of the player
    models.player.load(['context']).done(function (player) {
        if (models.player.context) {
            console.log("currently playing from context (playlist) " + models.player.context.uri);
        }
    });
    //ENDREGION initial setup

    //REGION Stuff for html page
    var rm = $(".readmore");
    //for multiple expanders only allowing one open - var hi = $('.hide');
    rm.click(function (e) {
        e.preventDefault();
        var now = $(this).siblings(".hide");
        now.slideToggle();
        if (now.is(":hidden")) {
            $(this).innerHTML = "Show";
        } else {
            $(this).innerHTML = "Hide";
        }

        //for multiple expanders only allowing one open - hi.not(now).filter(':visible').slideToggle();
    });
    //ENDREGION html tomfoolery

    models.player.addEventListener('change:track', function () {
        if (localStorage.album_radio_playlist) {
            var debug_box = document.querySelector('#debugging');
            if (models.player.context && models.player.context.uri.substr(-22) == localStorage.album_radio_playlist.substr(-22)) {
                console.log('Played a song from your playlist - trimming start of playlist');
                var playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);
                playlist.load('tracks').done(function (tracks) {
                    console.log('tracks loaded');
                    playlist.tracks.snapshot(0,500).done(function (playlist_tracks) {
                        console.log('snapshot loaded');
                        if (playlist_tracks.find(models.player.track)) {
                            var done=false;
/*
                            var tracks = playlist_tracks.toArray();
                            var num_deleted = 0;
                            var trigger_promise = new models.Promise();
                            var joined_promises = null;
                            var i = 0;
                            tracks.forEach(function (deleteme) {
                                if (deleteme == models.player.track) {
                                    console.log('here\'s our current track');
                                    done = true;
                                } else if (done) {
                                    //console.log('already done');
                                } else {
                                    num_deleted++;
                                    console.log('deleting ' + deleteme.uri);
                                    try {
                                        var remove_promise = playlist.tracks.remove(playlist_tracks.ref(i));
                                        if(joined_promises == null) {
                                            joined_promises = models.Promise.join(trigger_promise, remove_promise);
                                        } else {
                                            joined_promises = models.Promise.join(joined_promises, remove_promise);
                                        }
                                    } catch (err) { console.log("poo " + err); }
                                }
                                i++;
                            });
                            trigger_promise.setDone();
*/
                            playlist.tracks.snapshot(0, 1).done(function (sn) { deletePlayed(playlist, sn); });
                            //console.log(playlist_tracks.length - num_deleted);
                            if (playlist_tracks.length/*-num_deleted*/ < 500) {
                                //add an album
                                var artists = [];
                                models.player.track.artists.forEach(function(a) { artists.push(a); });
                                //models.Promise.join(joined_promises, artists[0].load('related')).always(function (related) {
                                artists[0].load('related').done(function (related) {
                                    console.log('yo');
                                    artists[0].related.snapshot().done(function (related_artists_snapshot) {
                                        var related_artists = related_artists_snapshot.toArray();
                                        related_artists.forEach(function (rel) { artists.push(rel); });
                                        console.log(artists.length + " artists");
                                        //TODO: add starred and subscribed artists
                                        //pick a random artist from the list
                                        var found_one = false;
                                        //while(!found_one)
                                        {
                                            var rand = artists[Math.floor(Math.random() * artists.length)];
                                            rand.load('albums', 'name').done(function (albums) {
                                                rand.albums.snapshot().done(function (s) {
                                                    s.loadAll().done(function (albums_snapshot) {
                                                        function isPlayable(album) { return album.playable = true; }
                                                        var albums = albums_snapshot.filter(isPlayable);
                                                        var selected_album = albums[Math.floor(Math.random() * albums.length)].albums[0];
                                                        selected_album.load('name', 'tracks').done(function () {
                                                            //refresh the tracks
                                                            //playlist.tracks.snapshot(0, 500).done(function (playlist_tracks) {
                                                              //  console.log('snapshot reloaded');

                                                            //});
                                                            selected_album.tracks.filter('==', 'playable', 'true').snapshot().done(function (s) {
                                                                s.loadAll().done(function (tracks_to_append) {
                                                                    playlist.tracks.add(tracks_to_append)
                                                                        .done(function () {
                                                                            console.log("appended songs");
                                                                            var debug_message = document.createElement('p');
                                                                            debug_message.innerHTML = 'Added ' + tracks_to_append.length + ' songs to playlist from ' + rand.name + '\'s album ' + selected_album.name;
                                                                            debug_box.appendChild(debug_message);
                                                                            debug_box.scrollTop = debug_box.scrollHeight;
                                                                            populateAlbumsBox();
                                                                        })
                                                                        .fail(function (blah, err) { console.log("failed to append " + err.message); });
                                                                });
                                                            });
                                                        }).fail(function (blah, err) { console.log(err.message); });
                                                        found_one = true;
                                                    });
                                                });
                                            });
                                        }
                                    });
                                });
                            } else {
                                console.log("we have enough songs");
                            }
                        }
                    });
                });
            }
        }
    });    
}
)