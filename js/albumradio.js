/*globals R, Main, Spinner, rdioUtils */

(function () {

    // ==========
    window.Main = {
        Models: {},
        Views: {},
        currentView: null,
        streamRegion: 'US',
        skippy: false,

        // ----------
        init: function () {
            var self = this;
            $("#unauthorized").toggle(false);
            $("#playlist_selection").toggle(false);

            if (!rdioUtils.startupChecks()) {
                return;
            }

            R.ready(function () {
                //self.spin(false);
                if (R.authenticated()) {
                    self.beenAuthenticated();
                    //self.go("following");
                } else {
                    $("#unauthorized").toggle(true);
                    //self.go("unauthenticated");
                }
            });

            //self.spin(true);
            var play_button = document.getElementById('play');
            rdioUtils._bind(play_button, 'click', function (event) {
                rdioUtils._stopEvent(event);
                R.player.play();
            });
            var pause_button = document.getElementById('pause');
            rdioUtils._bind(pause_button, 'click', function (event) {
                rdioUtils._stopEvent(event);
                R.player.pause();
            });
            var skip_button = document.getElementById('fwd');
            rdioUtils._bind(skip_button, 'click', function (event) {
                rdioUtils._stopEvent(event);
                self.skippy = true;
                R.player.next();
            });
        },

        beenAuthenticated: function() {
            var self = this;
            var url = R.currentUser.get('url');
            console.log(url);

            R.request({
                method: 'currentUser',
                content: {
                    extras: '-*,streamRegion'
                },
                success: function (data) {
                    self.streamRegion = data.result.streamRegion;
                },
                error: function (response) {
                    console.log(response.message);
                }
            });
/*
            R.request({
                method: 'getObjectFromUrl',
                content: {
                    url: url
                },
                success: function (data) {
                    var username = data.result.firstName + ' ' + data.result.lastName;
                    self.currentUserKey = data.result.key;
                    console.log(data.result.key);
                    console.log(self.currentUserKey);
*/
                    $("#unauthorized").toggle(false);
                    if (localStorage.lastUser == R.currentUser.get('key') && localStorage.album_radio_playlist != null) {
                        self.loadPlaylist();
                    } else {
                        self.showPlaylistSelector();
                    }
                    localStorage.lastUser = R.currentUser.get('key');
/*
                },
                error: function (response) {
                    console.log("error: " + response.message);
                }
            });
*/
        },

        showPlaylistSelector: function() {
            var self = this;
            $("#playlist_selection").toggle(true);
            R.request({
                method: 'getUserPlaylists',
                content: {
                    user: R.currentUser.get('key'),
                    count: 100
                },
                success: function (data) {
                    var combo = $("#playlist_selector");
                    combo.innerHTML = "";
                    combo.append($("<option></option>")
                            .attr("value", 0));
                    for (var i = 0; i < data.result.length; i++) {
                        combo.append($("<option></option>")
                            .attr("value", data.result[i].key)
                            .text(data.result[i].name));
                    }
                    combo.change(function (event) {
                        console.log(combo.val());
                        $("#playlist_selection").toggle(false);
                        localStorage.album_radio_playlist = combo.val();
                        self.loadPlaylist();
                    });
                    //TODO: check if length == 100 and get more
                },
                error: function (response) {
                    console.log("error: " + response.message);
                }
            });
        },

        loadPlaylist: function () {
            var self = this;
            var debug_box = document.querySelector('#debugging');
            var debug_message = document.createElement('p');
            debug_message.innerHTML = 'You have a playlist stored in localstorage: ' + localStorage.album_radio_playlist + " - " + new Date().toUTCString();
            debug_box.appendChild(debug_message);
            if (debug_box.children.length > 4)
                debug_box.removeChild(debug_box.children[0]);
            var allowed_message = document.createElement('p');
            allowed_message.innerHTML = 'Working with previously stored playlist';
            document.getElementById('noplaylistmsg').style.display = 'none';
            drop_box.appendChild(allowed_message);
            setTimeout(function () {
                allowed_message.remove();
            }, 5000);
            R.player.on('change:playingTrack', self.trackChanged, self);
/*
            R.player.on('change:playingSource', function (foo, bar) {
                console.log("something changed w/ source " + bar);
            });
*/
            self.trackChanged();
/*
            var tracks = R.player.playingSource().get("tracks");
            tracks.on('add', function (model, collection, info) { console.log("add event"); });
            tracks.on('remove', function (model, collection, info) { console.log("remove event"); });
            tracks.on('reset', function (model, collection, info) { console.log("reset event"); });
            tracks.on("all", function (model, collection, info) { console.log("all event"); });
            R.player.playingSource().on("all", function (eventname) { console.log("source event " + eventname); });
*/
        },

        trackChanged: function() {
            var self = this;
            var was_skippy = self.skippy;
            self.skippy = false;

            var curr_track = R.player.playingTrack();
            document.getElementById("current_track").innerHTML = "Now playing: " + curr_track.get("name") + " by " + curr_track.get("artist");
            var debug_box = document.querySelector('#debugging');
            if (localStorage.album_radio_playlist == R.player.playingSource().get("key")) {
                console.log('Played a song from your playlist - trimming start of playlist');
                var player_source_playlist = R.player.playingSource();
                document.getElementById('playlist_name').innerHTML = player_source_playlist.get("name");
                var tracks = player_source_playlist.get("tracks");
                var curr_song = curr_track.get("key");
                var album_box = document.getElementById('album_box');
                var current_album_element = album_box.getElementsByClassName('ar-big-album')[0];
                var curr_album = null;
                if (current_album_element) {
                    curr_album = current_album_element.id;
                }
                var need_album_refresh = false;
                var num_songs = tracks.length;
                if (num_songs > clock.getTime()) {
                    need_album_refresh = true;
                }
                var keys = [];
                var finished_artist = null;
                for (var i = 0, l = tracks.length; i < l; i++) {
                    var track = tracks.at(i);
                    var trackalbum = track.get("albumKey");
                    if (trackalbum != curr_album) {
                        need_album_refresh = true;
                    }
                    if (i == 0) {
                        finished_artist = track.get("artistKey");
                    }
                    var trackkey = track.get("key");
                    if (trackkey === curr_song) {
                        break;
                    }
                    keys.push(trackkey);
                }
                console.log("currently playing index " + i);
                if(i > 0) {
                    if (i > 1) {
                        console.log("possible bug?");
                        console.log(curr_song);
                        console.log(R.player.playingTrack().get("key"));
                        console.log("would have deleted " + keys.join(','));
                        var debug_message = document.createElement('p');
                        debug_message.innerHTML = 'Did not delete finished song due to possible bug.  Please manually delete played songs from your playlist on Rdio';
                        debug_box.appendChild(debug_message);
                        if (debug_box.children.length > 4)
                            debug_box.removeChild(debug_box.children[0]);
                        if (need_album_refresh) {
                            self.populateAlbumsBox();
                        }
                        return;
                    }
                    R.request({
                        method: 'removeFromPlaylist',
                        content: {
                            playlist: localStorage.album_radio_playlist,
                            index: 0,
                            count: keys.length,
                            tracks: keys.join(',')
                        },
                        success: function (data) {
                            console.log("yay, deleted songs");
                            num_songs -= keys.length;
                            clock.setValue(num_songs);


                            if (num_songs <= 500) {
                                if (was_skippy)
                                    finished_artist = null;
                                self.addRelatedArtist(finished_artist);
                            }
                            if (need_album_refresh) {
                                self.populateAlbumsBox();
                            } else {
                                var album_box = document.getElementById('album_box');
                                var progressbar = album_box.firstChild.getElementsByTagName('progress')[0];
                                progressbar.value = progressbar.value + keys.length;
                            }
                        },
                        error: function (response) {
                            console.log("error: " + response.message);
                        }
                    });
                } else {
                    if (need_album_refresh) {
                        self.populateAlbumsBox();
                    }
                }
            }
        },

        populateAlbumsBox: function () {
            var self = this;
            console.log("populating album box");
            var album_box = document.getElementById('album_box');
            album_box.innerHTML = '';
            
            var key_counts = self.getPlaylistAlbums();
            //console.log(key_counts);
            var just_keys = _.keys(key_counts);
            //console.log(just_keys);

            //At this point, I don't think I can eliminate this request in favor of accessing something from player_source_playlist
            //I probably should start caching some of it at some point, though
            R.request({
                method: 'get',
                content: {
                    keys: just_keys.join(','),
                    extras: '-*,icon,name,artist,url,artistUrl,length,key,bigIcon1200' //,artistKey'
                },
                success: function (data) {
                    //console.log(data.result);
                    var first_album = true;
                    _.each(key_counts, function (v, k) {
                        var album = data.result[k];
                        var widget = self.albumWidget(album, v, first_album);
                        album_box.appendChild(widget);
                        if (first_album) {
                            //test only
                            //self.addRelatedArtist(album.artistKey);

                            var bg = document.querySelector('#bgImageContainer');
                            bg.innerHTML = '<img class="sp-image" src="'+album.bigIcon1200+'" alt="large artwork" border="0"/>';
                                                        
                            var starplus_button = document.createElement('div');
                            starplus_button.classList.add('starplusr');
                            starplus_button.title = 'Add current song to collection, follow artist, and add another album from this artist, if available';
                            widget.appendChild(starplus_button);
                            rdioUtils._bind(starplus_button, 'click', function (event) {
                                rdioUtils._stopEvent(event);
                                self.starPlus();
                            });


                            first_album = false;
                        }
                    });
                }
            });      
        },

        albumWidget: function (album, num_left, first) {
            var self = this;
            var _element = document.createElement('div');
            _element.className = first ? 'ar-album ar-big-album' : 'ar-album ar-small-album';

            var _broken = false;

            if (album) {
                if (album.key && !/^(a|al)[0-9]/.test(album.key)) {
                    console.log('Bad key for album widget: ' + album.key);
                    _broken = true;
                }
                var required = ['url', 'icon', 'name', 'artist', 'artistUrl', 'key'];
                for (i = 0; i < required.length; i++) {
                    if (!album[required[i]]) {
                        console.log('Missing ' + required[i] + ' for album widget', album);
                        _broken = true;
                    }
                }
            } else {
                console.log('Album is required for album widget');
                _broken = true;
            }
            _element.id = album.key;

            if (_broken) {
                _element.innerHTML = ''
                + '<div class="album-cover">'
                + '<div class="album-icon"></div>'
                + '</div>'
                + '<div class="album-title truncated">Unknown Album</div>'
                + '<div class="album-author truncated">&nbsp;</div>'
                + '<div class="album-size truncated">&nbsp;</div>';
            } else {
                var html = ''
                + '<div class="album-cover">'
                + '<a href="http://www.rdio.com' + rdioUtils._escape(album.url) + '" target="rdio">'
                + '<div class="album-icon" style="background-image: url(' + rdioUtils._escape(album.icon) + ')"></div>'
                //+ '<div class="album-hover-overlay">'
                //+ '<div class="album-play-btn"></div>'
                // + '<div class="album-action-btn"></div>'
                + '</div>'
                + '</a>'
                + '</div>'
                + '<div class="deleter" title="Delete This Album"></div>'
                //+ '<div class="album-title truncated"><a href="http://www.rdio.com' + rdioUtils._escape(album.url) + '">' + rdioUtils._escape(album.name) + '</a></div>'
                //+ '<div class="album-author truncated"><a href="http://www.rdio.com' + rdioUtils._escape(album.artistUrl) + '">' + rdioUtils._escape(album.artist) + '</a></div>'
                ;

                if (album.length && first) {
                    //html += '<div class="album-size truncated">'
                    //+ rdioUtils._escape(album.length) + ' songs</div>';
                    var num = album.length - num_left;
                    if (num < 0)
                        num = 0;
                    html += '<progress class="bottomright" value="' + num + '" max="' + album.length + '">';
                }

                _element.innerHTML = html;

                var delete_button = _element.getElementsByClassName('deleter')[0];
                rdioUtils._bind(delete_button, 'click', function (event)
                {
                    rdioUtils._stopEvent(event);
                    self.deleteAlbum(album.key);
                });

                /*
                            var links = _element.getElementsByTagName('a');
                            for (i = 0; i < links.length; i++) {
                                rdioUtils._bind(links[i], 'click', linkClickHandler);
                            }
                */

/*
                var button = _element.getElementsByClassName('album-play-btn')[0];
                rdioUtils._bind(button, 'click', function (event) {
                    rdioUtils._stopEvent(event);

                    if (event.altKey || event.metaKey) {
                        R.player.queue.addPlayingSource();
                    }
                    R.player.play({ source: album.key });
                });
*/

                // button = this._element.getElementsByClassName('album-action-btn')[0];
                // rdioUtils._bind(button, 'click', function(event) {
                //   self._openActionMenu();
                // });
            }

            return _element;
        },

        deleteAlbum: function (albumkey) {
            var self = this;
            console.log('kill ' + albumkey);
            R.request({
                method: 'get',
                content: {
                    keys: localStorage.album_radio_playlist,
                    extras: '[{"field": "tracks", "extras": ["-*","key","albumKey"]}]'
                },
                success: function (data) {
                    var tracks = data.result[localStorage.album_radio_playlist].tracks;
                    var keys = [];
                    var found_album = false;
                    var start_index = -1;
                    for (var i = 0, l = tracks.length; i < l; i++) {
                        if (found_album && tracks[i].albumKey != albumkey) {
                            break;
                        }
                        if (tracks[i].albumKey === albumkey) {
                            if (!found_album) {
                                found_album = true;
                                start_index = i;
                            }
                            keys.push(tracks[i].key);
                        }
                    }
                    if (found_album) {
                        R.request({
                            method: 'removeFromPlaylist',
                            content: {
                                playlist: localStorage.album_radio_playlist,
                                index: start_index,
                                count: keys.length,
                                tracks: keys.join(',')
                            },
                            success: function (data) {
                                console.log("yay, deleted "+keys.length+" songs for album " + albumkey);
                                self.populateAlbumsBox();
                                if (start_index == 0) {
                                    self.skippy = true;
                                }
                            },
                            error: function (response) {
                                console.log("error: " + response.message);
                            }
                        });
                    }
                }
            });
        },

        getPlaylistAlbums: function () {
            var player_source_playlist = R.player.playingSource();
            var tracks = player_source_playlist.get("tracks");
            clock.setValue(tracks.length);
            var key_counts = _.countBy(tracks.models, function (t) {
                return t.get("albumKey");
            });
            return key_counts;
        },

        addRelatedArtist: function(artist) {
            var self = this;
            console.log(artist);
            if (artist != null) {
                var url = 'http://developer.echonest.com/api/v4/artist/similar';
                url += '?api_key=MJPHN8QH05LGIAYID';
                url += '&name=rdio-' + self.streamRegion + ':artist:' + artist;
                url += '&bucket=id:rdio-' + self.streamRegion;
                url += '&format=jsonp&callback=?';
                $.getJSON(url, function (data) {
                    var artists = [];
                    artists.push(artist);
                    _.each(data.response.artists, function (a) {
                        if (typeof a.foreign_ids === "undefined" || a.foreign_ids.length < 1) {
                            console.log("artist " + a.name + " didn't have a rdio id. Similar to " + artist);
                        } else {
                            artists.push(a.foreign_ids[0].foreign_id.substr(15))
                        }
                    });
                    self.addRandomArtistAlbum(artists);
                });
            } else {
                R.request({
                    method: 'getArtistsInCollection',
                    content: {
                        extras: '-*,artistKey'
                    },
                    success: function (data) {
                        var artists = [];
                        _.each(data.result, function (a) {
                            artists.push(a.artistKey);
                        });
                        console.log("picking from your " + artists.length + " artists for an album, since you skipped");
                        self.addRandomArtistAlbum(artists);
                    },
                    error: function (response) {
                        console.log("error: " + response.message);
                    }
                });
            }
        },

        addRandomArtistAlbum: function(artists, call_count) {
            if (typeof call_count === "undefined" || !call_count) {
                call_count = 1;
            } else {
                if (call_count > 5) {
                    console.log("giving up on adding album, too many dups");
                    return;
                }
            }

            var self = this;
            var playlist_albums = _.keys(self.getPlaylistAlbums());

            console.log(playlist_albums.length + " albums already in playlist. Picking from this many artists: " + artists.length);
            //pick a random artist from the list
            var found_one = false;
            var rand = artists[Math.floor(Math.random() * artists.length)];
            R.request({
                method: 'getAlbumsForArtist',
                content: {
                    artist: rand,
                    extras: '-*,icon,name,artist,url,artistUrl,length,key,bigIcon1200,canStream,trackKeys'
                },
                success: function (data) {
                    //console.log(data.result);

                    function isPlayable(album) { return album.canStream == true; }
                    var albums = data.result.filter(isPlayable);
                    if (albums.length < 1) {
                        console.log("skipping artist because he has no playable albums - " + rand);
                        self.addRandomArtistAlbum(artists, call_count + 1);
                        return;
                    }
                    var selected_album = albums[Math.floor(Math.random() * albums.length)];
                    if (playlist_albums.indexOf(selected_album.key) != -1) {
                        console.log("skipping album because it's already present");
                        self.addRandomArtistAlbum(artists, call_count + 1);
                        return;
                    }
                    var album_length = selected_album.trackKeys.length;
                    if(album_length < 3) {
                        console.log("skipping album because it's too short");
                        self.addRandomArtistAlbum(artists, call_count + 1);
                        return;
                    }

                    R.request({
                        method: 'addToPlaylist',
                        content: {
                            playlist: localStorage.album_radio_playlist,
                            tracks: selected_album.trackKeys.join(',')
                        },
                        success: function (data) {
                            console.log("yay, added " + album_length + " songs for album " + selected_album.key);
                            //self.populateAlbumsBox();
                            var widget = self.albumWidget(selected_album, album_length, false);
                            album_box.appendChild(widget);
                            var debug_message = document.createElement('p');
                            debug_message.innerHTML = 'Added ' + album_length + ' songs to playlist from ' + selected_album.artist + '\'s album ' + selected_album.name;
                            var debug_box = document.querySelector('#debugging');
                            debug_box.appendChild(debug_message);
                            if (debug_box.children.length > 4)
                                debug_box.removeChild(debug_box.children[0]);
                            var num_songs = Number(clock.getTime()) + album_length;
                            clock.setValue(num_songs);
                        },
                        error: function (response) {
                            console.log("error: " + response.message);
                        }
                    });
                }
            });
        },

        starPlus: function () {
            //Three things for starplus
            //1) add song to collection
            R.request({
                method: 'addToCollection',
                content: {
                    keys: R.player.playingTrack().get("key")
                },
                success: function (data) {
                    console.log("added current track to collection");
                },
                error: function (response) {
                    console.log("error: " + response.message);
                }
            });
            //2) add another album from the artist
            var artists = [];
            var artistkey = R.player.playingTrack().get("artistKey");
            artists.push(artistkey);
            this.addRandomArtistAlbum(artists);
            //3) Follow artist
            R.request({
                method: 'get',
                content: {
                    keys: artistkey,
                    extras: '-*,bandMembers'
                },
                success: function (data) {
                    _.each(data.result[artistkey].bandMembers, function(bm) {
                        console.log("bandmember: " + bm.firstName + " " + bm.lastName + " - " + bm.key);
                        R.request({
                            method: 'addFriend',
                            content: { user: bm.key },
                            success: function (data) {
                                console.log("followed " + bm.firstName);
                            },
                            error: function (response) {
                                console.log("error: " + response.message);
                            }
                        });
                    });
                },
                error: function (response) {
                    console.log("error: " + response.message);
                }
            });
        },

        // ----------
/*
        go: function (mode) {
            var $div = $("<div>")
              .attr("id", mode)
              .append(self.template(mode));

            $("#content")
              .empty()
              .append($div);

            self.mode = mode;
            var viewClass = self.upperCaseInitial(self.mode);
            if (viewClass in self.Views) {
                self.currentView = new self.Views[viewClass]({
                    $el: $div
                });
            }
        },
*/

        // ----------
/*
        spin: function (value) {
            if (value) {
                self.spinner = new Spinner({
                    radius: 6,
                    length: 6,
                    width: 2,
                    color: '#444'
                }).spin($("#spin-container")[0]);
            } else {
                self.spinner.stop();
            }
        },
*/

        // ----------
        /*template: function (name, config) {
            var rawTemplate = $.trim($("#" + name + "-template").text());
            var template = _.template(rawTemplate);
            var html = template(config);
            return $(html);
        },*/

        // ----------
        upperCaseInitial: function (val) {
            return val.replace(/^([a-z])/, function ($0, $1) {
                return $1.toUpperCase();
            });
        }
    };

    // ----------
    $(document).ready(function () {
        Main.init();
    });

})();

//Authentication
(function () {

    // ==========
    //Main.Views.Unauthenticated = function () {
        $("#authenticate")
          .click(function () {
              R.authenticate(function (authenticated) {
                  if (authenticated) {
                      Main.authenticated();
                  }
              });
/*
              R.authenticate({
                  linkshareId: 'foo',
                  complete: function (authenticated) {
                      if (authenticated) {
                          Main.authenticated();
                      }
                  }
              });
*/
          });
    //};

})();

    var clock = null;
    $(document).ready(function() {          
        clock = $('#playlist_count').FlipClock(0, {
            clockFace: 'Counter',
            countdown: true
        });
    });

    //REGION Handle drops, html style
    var drop_area = document.body; 

    drop_area.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/html', self.innerHTML);
        e.dataTransfer.effectAllowed = 'copy';
    }, false);

    drop_area.addEventListener('dragenter', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        self.classList.add('over');
    }, false);

    drop_area.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        return false;
    }, false);

    drop_area.addEventListener('dragleave', function (e) {
        e.preventDefault();
        self.classList.remove('over');
    }, false);

    drop_area.addEventListener('drop', function (e) {
        e.preventDefault();
        console.log('droppy ' + e.dataTransfer.getData('text'));
/*
        var drop = models.Playlist.fromURI(e.dataTransfer.getData('text'));
        self.classList.remove('over');
        var success_message = document.createElement('p');
        success_message.innerHTML = 'Playlist successfully dropped: ' + drop.uri;
        self.appendChild(success_message);
        drop.load('owner').done(function (playlist) {
            playlist.owner.load('currentUser').done(function (owner) {
                if (owner.currentUser) {
                    var allowed_message = document.createElement('p');
                    allowed_message.innerHTML = 'You are the owner of this playlist, let\'s get to work!';
                    drop_box.appendChild(allowed_message);
                    setTimeout(function () {
                        allowed_message.remove();
                    }, 5000);
                    localStorage.album_radio_playlist = drop.uri;
                    document.getElementById('noplaylistmsg').style.display = 'none';
                    populateAlbumsBox();
                }
                else {
                    var disallowed_message = document.createElement('p');
                    disallowed_message.innerHTML = 'You are not the owner of this playlist, choose a different one please!';
                    drop_box.appendChild(disallowed_message);
                    setTimeout(function () {
                        disallowed_message.remove();
                    }, 5000);
                    localStorage.album_radio_playlist = null;
                    document.getElementById('noplaylistmsg').style.display = '';
                }
            });
        });
*/
    }, false);


    //ENDREGION drag/drop

    //only pass callback to this


    //ENDREGION

    //REGION initial setup
/*
    // find out initial status of the player
    models.player.load(['context']).done(function (player) {
        if (models.player.context) {
            console.log("currently playing from context (playlist) " + models.player.context.uri);
        }
        / * Test for Niz on IRC
        models.player.playContext(models.Playlist.fromURI(localStorage.album_radio_playlist));
        setTimeout(function() {
            models.player.pause();
            setTimeout(function() {
                models.player.play();}, 
                5000);},
            5000);
            * /
    });
*/
    //ENDREGION initial setup

    //REGION Stuff for html page
    var rm = $(".readmore");
    rm.click(function (e) {
        e.preventDefault();
        var now = $(this).parent().siblings(".hide");
        var bob = this;
        now.slideToggle(400, function () {
            if (bob.innerHTML == "Hide") {
                bob.innerHTML = "Show";
            } else {
                bob.innerHTML = "Hide";
            }
        });
    });
    //ENDREGION html tomfoolery

    /*models.player.addEventListener('change', function (e) {
        console.log(e);
        console.log(e.data.duration); //this seems to indicate skipped, if 0
        console.log(e.data.track.uri);
        console.log(e.target.track);
    });*/	

/*
    models.player.addEventListener('change:track', function (e) {
        if (localStorage.album_radio_playlist) {
            var debug_box = document.querySelector('#debugging');
            if (models.player.context && models.player.context.uri.substr(-22) == localStorage.album_radio_playlist.substr(-22)) {
                console.log('Played a song from your playlist - trimming start of playlist');
                var playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);
                playlist.load('tracks').done(function (tracks) {
                    playlist.tracks.snapshot(0, 500).done(function (playlist_tracks) {
                        if (playlist_tracks.find(models.player.track)) {
                            playlist.tracks.snapshot(0, 1).done(function (sn) { deletePlayed(playlist, sn); });
                            if (playlist_tracks.length/ *-num_deleted* / <= 500) {
                                //add an album
                                var artists = [];
                                if (e.target.duration != 0) {
                                    e.oldValue.artists.forEach(function (a) { artists.push(a); });
                                    artists[0].load('related').done(function (related) {
                                        artists[0].related.snapshot().done(function (related_artists_snapshot) {
                                            var related_artists = related_artists_snapshot.toArray();
                                            related_artists.forEach(function (rel) { artists.push(rel); });
                                            //TODO: add starred and subscribed artists
                                            addRandomArtistAlbum(artists);
                                        });
                                    });
                                } else {
                                    console.log('you skipped a song, populating from starred artists');
                                    var library = Library.forCurrentUser();
                                    library.starred.load('tracks').done(function (starred_playlist) { 
                                        starred_playlist.tracks.snapshot().done(function (snapshot) {
                                            snapshot.loadAll('artists')
                                                .each(function (track) {
                                                    if (artists.indexOf(track.artists[0]) == -1) {
                                                        artists.push(track.artists[0]);
                                                    }
                                                })
                                                .done(function (tracks) {
                                                    addRandomArtistAlbum(artists);
                                                });
                                        });
                                    });
                                }
                            } else {
                                console.log("we have enough songs");
                            }
                        }
                    });
                });
            }
        }
    });
*/

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

/*
}
);
*/


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

/* for http://stackoverflow.com/questions/20440664/incorrect-snapshot-length-returned-for-a-specific-playlist
require(['$api/models'], function(models) {
    var playlist = models.Playlist.fromURI("spotify:user:juan20150:playlist:5rl5QaWjWtEPv9a057w3qc");
    playlist.load('tracks').done(function() {

        playlist.tracks.snapshot().done(function(snapshot) {
            console.log("snapshot length " + snapshot.length);
            var i=0;
            snapshot.loadAll('name')
                //.each(function(t) { console.log(i++); })
               .done(function(snap_tracks) { console.log("loaded tracks length " + snap_tracks.length); })
               .fail(function(track, error) { console.log(error + ". " + track.length); });
        });

    });
});
*/

/* for http://stackoverflow.com/a/20478974/9970
require(['$api/models'], function(models) {
var mySpotify =
{
  playerNextTrack: function()
  {
    models.player.skipToNextTrack();
  },
}

var playtest = document.querySelector('#playtest');
playtest.addEventListener('click', function() { mySpotify.playerNextTrack(); });

});*/

/* from sample code, to repro http://stackoverflow.com/questions/20907867/realtimeanalyzer-memory 
var numRows = 16, bars = [];
for (var i = 0; i < numRows * 2; i++) {
    var bar = document.createElement('meter');
    bar.min = -1;
    document.body.appendChild(bar);

    // Add a newline after each pair of bars.
    if (i % 2) document.body.appendChild(document.createElement('br'));

    bars.push(bar);
}

require(['$api/audio', '$api/models'], function (audio, models) {
    var analyzer = audio.RealtimeAnalyzer.forPlayer(models.player);

    analyzer.addEventListener('audio', function (evt) {
        // There will be 256 samples, but we want to only display every [step]
        // samples because we have fewer than 256 rows.
        var step = 256 / numRows;
        for (var i = 0; i < numRows; i++) {
            bars[i * 2].value = evt.audio.wave.left[step * i];
            bars[i * 2 + 1].value = evt.audio.wave.right[step * i];
        }
    });
});
*/

/*
require(['$api/models'], function(models) {

    models.player.addEventListener('change:context', contextChanged);

    var last_context=null;
    function contextChanged(e) {
        if(last_context != e.target.context.uri) {
            last_context = e.target.context.uri;
            console.log('hola, new context uri - ' + last_context);
        }
        else {
            console.log('faux context change');
        }
    }
});
*/

/* http://stackoverflow.com/questions/21178883/how-to-get-list-of-artist-following-in-spotify 
require(['$api/models', '$api/relations#Relations'], function (models, Relations) {
  var rels = Relations.forCurrentUser();
  rels.combinedSubscriptions.snapshot().done(function(snapshot) {
    console.log('You are following ' +  snapshot.length + ' users/artists.');
    console.log('Here are your followings:' + snapshot.toArray());
    var deftones = models.Artist.fromURI('spotify:artist:6Ghvu1VvMGScGpOUJBAHNH');
    console.log(snapshot.find(deftones));
    var notdeftones = models.Artist.fromURI('spotify:artist:6Ghvu1VvMGScGpOUJBAHHH');
    console.log(snapshot.find(notdeftones));
  });
});
*/

/* http://stackoverflow.com/questions/22121781/spotifys-collections-shuffle-method-not-working-as-expected
    require(['$api/models'], function (models) {
        playlist = models.Playlist.fromURI(localStorage.album_radio_playlist);

        playlist.load('tracks').done(function (tracks) {
            console.log(tracks);
            // Works when shuffle() is removed                    
            playlist.tracks.shuffle().snapshot()
              .done(

                function (snapshot) {
                    console.log(snapshot);

                    for (var i = 0; i < snapshot.length; i++) {
                        var track = snapshot.get(i);
                        console.log(track.name);
                    }
                }
              ).fail(function (blah, err) { console.log("failed to shuffle " + err + ", " + blah); });
        });
    });
    */
