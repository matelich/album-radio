require([
    '$api/models', '$api/library#Library', '$views/image#Image', '$views/throbber#Throbber'
      //,'$api/toplists#Toplist'
      , '$api/audio'
], function (models, Library, Image, Throbber/*, Toplist*/, audio) {
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
    function starPlus(e) {
        var library = Library.forCurrentUser();
        library.star(models.player.track).done(function () { console.log("Added current song to Starred"); });
        var artists = [];
        models.player.track.artists.forEach(function (a) { artists.push(a); });
        addRandomArtistAlbum(artists);
    }

    function deleteAlbum(e) {
        var playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);
        models.player.track.load('album').done(function () {
            var album_uri = e.target.parentNode.getAttribute('data-uri');
            var next_track = (album_uri == models.player.track.album.uri);

            playlist.load('tracks').done(function (tracks) {
                playlist.tracks.snapshot(0, 20).done(function (s) {
                    s.loadAll('album').done(function (sn) { deleteAlbumTracks(playlist, album_uri, next_track, s, sn, 0); });
                });
            });
        });
    }

    function deleteAlbumTracks(playlist, album_uri, next_track, snappy, snap_tracks, start_index) {
        if (snap_tracks.length == 0) { return; }

        for (var i = 0; i < snap_tracks.length; i++) {
            if (snap_tracks[i].album.uri.substr(-22) == album_uri.substr(-22)) //substr because this check was failing, and substr forces a string format(?)
            {
                if (i == snap_tracks.length - 1 && snap_tracks.length != 1) { //we need to have the song after the one we're deleting, so just get the next snap with this one included
                    playlist.tracks.snapshot(start_index + i, 20).done(function (s) {
                        s.loadAll('album').done(function (sn) { deleteAlbumTracks(playlist, album_uri, next_track, s, sn, start_index + i); });
                    });
                } else {
                    var done_with_album = (snap_tracks.length == 1 || (snap_tracks[i].album != snap_tracks[i + 1].album));
                    var index_to_delete = i;
                    if (snap_tracks.length != snappy.length) {
                        index_to_delete = start_index + i; //yes, this is scary.  I don't like it one little bit.  But it seems to work
                    }
                    playlist.tracks.remove(snappy.ref(index_to_delete)).done(function () {
                        console.log('deleted a song from album');
                        if (done_with_album) {
                            populateAlbumsBox();
                            if (next_track) {
                                models.player.skipToNextTrack();
                            }
                            return;
                        }
                        playlist.tracks.snapshot(start_index + i, 20).done(function (s) {
                            s.loadAll('album').done(function (sn) { deleteAlbumTracks(playlist, album_uri, next_track, s, sn, start_index + i); });
                        });
                    }).fail(function (blah, err) { console.log("failed to delete song " + err.message); });
                }
                return; //the for loop continues in the recursion
            }
        }
        playlist.tracks.snapshot(start_index + snap_tracks.length, 20).done(function (s) {
            s.loadAll('album').done(function (sn) { deleteAlbumTracks(playlist, album_uri, next_track, s, sn, start_index + i); });
        });
    }

    //only pass callback to this
    function getPlaylistAlbums(callback, snapshot, index, last_loaded_uri) {
        if (typeof snapshot === "undefined" || !snapshot) {
            var playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);
            playlist.load('tracks').done(function (tracks) {
                playlist.tracks.snapshot(0, 500).done(function (s) {
                    s.loadAll('album').done(function (playlist_tracks) {
                        getPlaylistAlbums(callback, playlist_tracks, 0);
                    });
                });
            });
        } else {
            if (index == 0) {
            }
            var albums_array = []; //huh, this is totz broken.  being saved by the snapshot keeping all the stuff from the last snapshot
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
                    if (snapshot.length >= 500) {
                        var playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);
                        playlist.load('tracks').done(function (tracks) {
                            playlist.tracks.snapshot(500 * (index + 1), 500).done(function (s) {
                                console.log('load extra songs: ' + s.length);
                                s.loadAll('album').done(function (playlist_tracks) {
                                    getPlaylistAlbums(callback, playlist_tracks, index + 1, albums_array[albums_array.length - 1].uri);
                                });
                            });
                        });
                    } else {
                        callback(albums_array);
                    }
                });
            }
            else {
                callback(albums_array);
            }
        }
    }

    //don't pass stuff in to this, let it handle the params itself
    function populateAlbumsBox(snapshot, index, last_loaded_uri) {
        if (typeof snapshot === "undefined" || !snapshot) {
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
                    var first_album = (index == 0);
                    albums_array.forEach(function (album) {
                        var album_title = album.name + ' by ';
                        var first = true;
                        album.artists.forEach(function (a) { if (!first) { album_title += ', '; } first = false; album_title += a.name; });
                        if (first_album) {
                            first_album = false;
                            var image = Image.forAlbum(album, { width: 192, height: 192, title: album_title });

                            var starplus_button = document.createElement('div');
                            starplus_button.innerHTML = 'X';
                            starplus_button.classList.add('starplusr');
                            starplus_button.title = 'Star current song and add another album from this artist, if available';
                            starplus_button.onclick = starPlus;
                            image.node.appendChild(starplus_button);
                        } else {
                            var image = Image.forAlbum(album, { width: 64, height: 64, title: album_title });
                        }
                        var delete_button = document.createElement('div');
                        delete_button.innerHTML = 'X';
                        delete_button.classList.add('deleter');
                        delete_button.title = 'Delete This Album';
                        delete_button.onclick = deleteAlbum;
                        image.node.appendChild(delete_button);

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
            else {
                throbber.hide();
            }
        }
    }

    function deletePlayed(playlist, snapshot) {
        if (snapshot.toArray()[0] != models.player.track) {
            var reload = (snapshot.toArray()[0].album != models.player.track.album);
            playlist.tracks.remove(snapshot.ref(0)).done(function () {
                console.log('deleted a song');
                if (reload) { populateAlbumsBox(); }
                playlist.tracks.snapshot(0, 1).done(function (sn) { deletePlayed(playlist, sn); });
            });
        }
    }

    function addRandomArtistAlbum(artists, playlist, playlist_albums, call_count) {
        if (typeof playlist === "undefined" || !playlist) {
            playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);
        }
        if (typeof playlist_albums === "undefined" || !playlist_albums) {
            getPlaylistAlbums(function (albums) { addRandomArtistAlbum(artists, playlist, albums); });
            return;
        }
        if (typeof call_count === "undefined" || !call_count) {
            call_count = 1;
        } else {
            if (call_count > 5) {
                console.log("giving up on adding album, too many dups");
                return;
            }
        }
        console.log(playlist_albums.length + " albums already in playlist");
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
                        if (playlist_albums.indexOf(selected_album) != -1) {
                            console.log("skipping album because it's already present");
                            addRandomArtistAlbum(artists, playlist, playlist_albums, call_count + 1);
                            return;
                        }
                        selected_album.load('name', 'tracks').done(function () {
                            //refresh the tracks
                            //playlist.tracks.snapshot(0, 500).done(function (playlist_tracks) {
                            //  console.log('snapshot reloaded');

                            //});
                            selected_album.tracks.filter('==', 'playable', 'true').snapshot().done(function (s) {
                                s.loadAll().done(function (tracks_to_append) {
                                    if (tracks_to_append.length < 3) {
                                        console.log("skipping album because it's too short");
                                        addRandomArtistAlbum(artists, playlist, playlist_albums, call_count + 1);
                                        return;
                                    }
                                    playlist.tracks.add(tracks_to_append)
                                        .done(function () {
                                            console.log("appended songs");
                                            var debug_message = document.createElement('p');
                                            debug_message.innerHTML = 'Added ' + tracks_to_append.length + ' songs to playlist from ' + rand.name + '\'s album ' + selected_album.name;
                                            debug_box.appendChild(debug_message);
                                            if (debug_box.children.length > 4)
                                                debug_box.removeChild(debug_box.children[0]);
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
    }

    //ENDREGION

    //REGION initial setup
    if (localStorage.album_radio_playlist) {
        var debug_box = document.querySelector('#debugging');
        var debug_message = document.createElement('p');
        debug_message.innerHTML = 'You have a playlist stored in localstorage: ' + localStorage.album_radio_playlist + " - " + new Date().toUTCString();
        debug_box.appendChild(debug_message);
        if (debug_box.children.length > 4)
            debug_box.removeChild(debug_box.children[0]);
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

    /*models.player.addEventListener('change', function (e) {
        console.log(e);
        console.log(e.data.duration); //this seems to indicate skipped, if 0
        console.log(e.data.track.uri);
        console.log(e.target.track);
    });*/

    models.player.addEventListener('change:track', function (e) {
        if (localStorage.album_radio_playlist) {
            //console.log(e);
            var debug_box = document.querySelector('#debugging');
            if (models.player.context && models.player.context.uri.substr(-22) == localStorage.album_radio_playlist.substr(-22)) {
                console.log('Played a song from your playlist - trimming start of playlist');
                var playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);
                playlist.load('tracks').done(function (tracks) {
                    console.log('tracks loaded');
                    playlist.tracks.snapshot(0, 500).done(function (playlist_tracks) {
                        console.log('snapshot loaded');
                        if (playlist_tracks.find(models.player.track)) {
                            playlist.tracks.snapshot(0, 1).done(function (sn) { deletePlayed(playlist, sn); });
                            //console.log(playlist_tracks.length - num_deleted);
                            if (playlist_tracks.length/*-num_deleted*/ < 500) {
                                //add an album
                                var artists = [];
                                models.player.track.artists.forEach(function (a) { artists.push(a); });
                                //models.Promise.join(joined_promises, artists[0].load('related')).always(function (related) {
                                artists[0].load('related').done(function (related) {
                                    console.log('yo');
                                    artists[0].related.snapshot().done(function (related_artists_snapshot) {
                                        var related_artists = related_artists_snapshot.toArray();
                                        related_artists.forEach(function (rel) { artists.push(rel); });
                                        //TODO: add starred and subscribed artists
                                        addRandomArtistAlbum(artists);
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

    /* from  http://stackoverflow.com/questions/19761821/return-top-track-spotify-api
    keeping around for future toplist access
    function doGetTopTrack(artist, num, callback) {
        var artistTopList = Toplist.forArtist(artist);

        artistTopList.tracks.snapshot(0,num).done(function (snapshot) { //only get the number of tracks we need

            snapshot.loadAll('name').done(function (tracks) {
                var i, num_toptracks;
                num_toptracks = num; //this probably should be minimum of num and tracks.length

                for (i = 0; i < num_toptracks; i++) {
                    callback(artist, tracks[i]);
                }
            });
        });
    };

    function showRelated() {
        var artist_properties = ['name', 'popularity', 'related', 'uri'];

        models.Artist
          .fromURI('spotify:artist:11FY888Qctoy6YueCpFkXT')
          .load(artist_properties)
          .done(function (artist) {

              artist.related.snapshot().done(function (snapshot) {
                  snapshot.loadAll('name').done(function (artists) {

                      for (var i = 0; i < artists.length; i++) {
                          // am I missing something here?
                          doGetTopTrack(artists[i], 1, function (artist, toptrack) {
                                  console.log("top track: " + toptrack.name);

                                  // store artist details
                                  var p = artist.popularity;
                                  var n = artist.name;
                                  var u = artist.uri;

                                  //listItem = document.createElement("li");
                                  console.log("<strong>Name</strong>: " + n.decodeForText() + " | <strong>Popularity: </strong> " + p + " | <strong>Top Track: </strong>" + toptrack.name);

                                  //// undefined name
                                  //$('#artistsContainer').append(listItem);
                          });
                      }
                  });

              });
          });
    };
    showRelated();
    */

}
);


/* for http://stackoverflow.com/questions/19763090/spotify-app-fire-function-on-change-position

require(['$api/audio', '$api/models', '$views/utils/frame#throttle'], function (audio, models, throttle) {
    var analyzer = audio.RealtimeAnalyzer.forPlayer(models.player);
    console.log('peep');

    var last_position = -1;
    analyzer.addEventListener('audio', function (evt) {
        models.player.load('position').done(function() {
            if(models.player.position != last_position) { 
                console.log(models.player.position + ", " + (models.player.position-last_position)); 
                last_position = models.player.position;
            }
        });
    });
    console.log('peep');
});*/

