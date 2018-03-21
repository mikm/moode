/**
 * moOde audio player (C) 2014 Tim Curtis
 * http://moodeaudio.org
 *
 * tsunamp player ui (C) 2013 Andrea Coiutti & Simone De Gregori
 * http://www.tsunamp.com
 *
 * This Program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3, or (at your option)
 * any later version.
 *
 * This Program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * 2018-01-26 TC moOde 4.0
 *
 */

var libRendered = false; // trigger library load

jQuery(document).ready(function($) { 'use strict';
    
    SESSION.json = sendMoodeCmd('GET', 'readcfgengine'); // load session vars
    RADIO.json = sendMoodeCmd('GET', 'readcfgradio'); // load radio stations
    THEME.json = sendMoodeCmd('GET', 'readcfgtheme'); // load themes

	// connect to mpd engine
    engineMpd();

	// connect to shairport-sync metadata engine
	if (SESSION.json['airplaymeta'] == '1' && SESSION.json['airplaysvc'] == '1') {
		engineSps();
	}
     
 	// update state/color of clock radio icons
	if (SESSION.json['ckrad'] == "Clock Radio" || SESSION.json['ckrad'] == "Sleep Timer") {
		$('#clockradio-icon').removeClass('clockradio-off')
		$('#clockradio-icon').addClass('clockradio-on')
	} else {
		$('#clockradio-icon').removeClass('clockradio-on')
		$('#clockradio-icon').addClass('clockradio-off')
	}
    
    // populate browse panel root 
    MpdDbCmd('filepath', UI.path, 'file');
    
    // setup pines notify
    $.pnotify.defaults.history = false;

	// set volume knob to readonly if mpd volume control 'disabled'
	// newui - todo: this is a terrible way to do the colors
	if (SESSION.json['mpdmixer'] == 'disabled') {
		$('#volume').attr('data-readOnly', 'true');
		$('#volume').attr('data-fgColor', '#333');
		$('#volumedn').css('display', 'none');
		$('#volumeup').css('display', 'none');
		$('#volumeslider').css('display', 'none');
		
		SESSION.json['volknob'] = '0';
		var result = sendMoodeCmd('POST', 'updcfgengine', {'volknob': SESSION.json['volknob']});
		$('#volume').val('0 dB');
	} 
	else {
		// pi 7" touch
		if ($(window).width() == 799 && $(window).height() == 479) {
			$('#volume').attr('data-readOnly', 'true');
		}
		else {
			$('#volume').attr('data-readOnly', 'false');
		}
		$('#volume').val(SESSION.json['volknob']);
		$('#mobilevolume').val(SESSION.json['volknob']);
		if( $("#mobile-toolbar").css('display') == 'flex') {
			$('#volumeslider').css('display', 'flex')
		}
	}

    // playback controls and volume buttons
    $('.btn-cmd').click(function() {
        var cmd, vol, volEvent, uiVolume;
		//console.log($(this).attr('id'));

        // play/pause
        if ($(this).attr('id') == 'play' || $(this).attr('id') == 'mplay') {
            if (MPD.json['state'] == 'play') {
				$("#play i").removeClass("icon-play").addClass("icon-pause");
				$("#mplay i").removeClass("icon-play").addClass("icon-pause");

	            if (MPD.json['file'].substr(0, 4).toLowerCase() == 'http') {
					if (MPD.json['artist'] == 'Radio station') {
	                	cmd = 'stop';
	            	} else {
		            	cmd = 'pause';  // upnp url
	                }
	            } else {
	                cmd = 'pause';
	            }

                $('#countdown-display').countdown('pause');
                
            } else if (MPD.json['state'] == 'pause') {
	            $("#play i").removeClass("icon-pause").addClass("icon-play");
	            $("#mplay i").removeClass("icon-pause").addClass("icon-play");
                cmd = 'play';
                $('#countdown-display').countdown('resume');
                                
				var current = parseInt(MPD.json['song']);
				customScroll('pl', current, 200);
				
            } else if (MPD.json['state'] == 'stop') {
                cmd = 'play';

				if (SESSION.json['timecountup'] == "1" || parseInt(MPD.json['time']) == 0) {
                    $('#countdown-display').countdown({since: 0, onTick: watchCountdown, compact: true, format: 'hMS', layout: '{h<}{hn}{sep}{h>}{mnn}{sep}{snn}'});
				} else {
                    $('#countdown-display').countdown({until: parseInt(MPD.json['time']), onTick: watchCountdown, compact: true, format: 'hMS', layout: '{h<}{hn}{sep}{h>}{mnn}{sep}{snn}'});
				}

				var current = parseInt(MPD.json['song']); // TC (Tim Curtis) 2015-04-29: add scrollto
				customScroll('pl', current, 200);
            }
            window.clearInterval(UI.knob);
            sendMpdCmd(cmd);

            return;
        }

        // next/prev
        else if ($(this).attr('id') == 'prev' || $(this).attr('id') == 'next' || $(this).attr('id') == 'mprev' || $(this).attr('id') == 'mnext') {
			$('#countdown-display').countdown('pause');
			window.clearInterval(UI.knob);
        }        

        // volume up/down/mute
        if ($(this).hasClass('btn-volume')) {
	        volEvent = '';
	        
	        var newVol;
			var volKnob = parseInt(SESSION.json['volknob']);
			
            if ($(this).attr('id') == 'volumedn' || $(this).attr('id') == 'volumedn-2') {
                newVol = volKnob > 0 ? volKnob - 1 : volKnob;
                volEvent = "volbtn";
            } else if ($(this).attr('id') == 'volumeup' || $(this).attr('id') == 'volumeup-2') {
				newVol = volKnob < 100 ? volKnob + 1 : volKnob;
                volEvent = "volbtn";
				
	            if (newVol > parseInt(SESSION.json['volwarning'])) {
		            $('#volume-warning-text').text('Volume setting ' + newVol + ' exceeds warning limit of ' + SESSION.json['volwarning']);
		            $('#volumewarning-modal').modal();
	            }
            } else if ($(this).attr('id') == 'volumemute' || $(this).attr('id') == 'volumemute-2') {
                if (SESSION.json['volmute'] == '0') {
	                SESSION.json['volmute'] = '1' // toggle to mute
                    $("#volumemute").addClass('btn-primary');
					$("#volumemute-2").addClass('btn-primary');
                    newVol = 0;
                    volEvent = "mute";
                } else {
	                SESSION.json['volmute'] = '0' // toggle to unmute
                    $("#volumemute").removeClass('btn-primary');
					$("#volumemute-2").removeClass('btn-primary');
					newVol = SESSION.json['volknob'];
                    volEvent = "unmute";
                }

				var result = sendMoodeCmd('POST', 'updcfgengine', {'volmute': SESSION.json['volmute']});
            }

			if (newVol <= parseInt(SESSION.json['volwarning'])) {				
				setVolume(newVol, volEvent);
			}

			return;
        }

        // toggle buttons, repeat, random, single, consume
        else if ($(this).hasClass('btn-toggle')) {
            if ($(this).hasClass('btn-primary')) {
                cmd = $(this).attr('id') + ' 0';
            } else {
                cmd = $(this).attr('id') + ' 1';
            }

            $(this).toggleClass('btn-primary');

        // send command
		// NOTE handles next/previous
        } 
		else {
	        if ($(this).attr('id') == 'prev' && parseInt(MPD.json['time']) > 0 && parseInt(sendMoodeCmd('GET', 'getmpdstatus')['elapsed']) > 0) {
	            refreshTimer(0, 0, 'stop'); // reset to beginning of song and pause
		        sendMpdCmd('seek ' + MPD.json['song'] + ' ' + 0);
		        if (MPD.json['state'] != 'pause') {
			        cmd = 'pause';
				}
				else {
					cmd = '';		        
		        }
	        }
			else if ($(this).attr('id') == 'mprev' && parseInt(MPD.json['time']) > 0 && parseInt(sendMoodeCmd('GET', 'getmpdstatus')['elapsed']) > 0) {			
	            refreshTimer(0, 0, 'stop'); // reset to beginning of song and pause
		        sendMpdCmd('seek ' + MPD.json['song'] + ' ' + 0);
		        if (MPD.json['state'] != 'pause') {
			        cmd = 'pause';
				}
				else {
					cmd = '';		        
		        }
			}
			else {
		        cmd = $(this).attr('id') == 'prev' ? 'previous' : $(this).attr('id');
			}
        }
		if (cmd.startsWith('m')) {
			cmd = cmd.substr(1);
		}
		if (cmd == 'prev') {cmd = 'previous';}

		// auto-shuffle
		if (cmd.substr(0, 6) == 'random' && SESSION.json['ashufflesvc'] == '1') {
			var toggleVal = cmd.substr(7, 1);
			var resp = sendMoodeCmd('GET', 'ashuffle', {'ashuffle':toggleVal});
			toggleVal == '1' ? $('#consume').addClass('btn-primary') : $('#consume').removeClass('btn-primary');
			toggleVal == '1' ? $('#mconsume').addClass('btn-primary') : $('#mconsume').removeClass('btn-primary');
			sendMpdCmd('consume ' + toggleVal);
		} else {
	        sendMpdCmd(cmd);
			//console.log('sendMpdCmd ' + cmd);
		}
    });

    // countdown time knob
    $('.playbackknob').knob({
        inline: false,
		change : function (value) {
            if (MPD.json['state'] != 'stop') {
				window.clearInterval(UI.knob)
				// update time display when changing slider
				var seekto = Math.floor((value * parseInt(MPD.json['time'])) / 1000);
				if (SESSION.json['timecountup'] == "1" || parseInt(MPD.json['time']) == 0) {
					$('#countdown-display').html(formatSongTime(seekto)); // count up
				} else {
					$('#countdown-display').html(formatSongTime(parseInt(MPD.json['time']) - seekto)); // count down
				}
			} else {
				$('#time').val(0);
			}
			
			// repaint needed 
			UI.knobPainted = false;
        },
        release : function (value) {
			if (MPD.json['state'] != 'stop') {
				window.clearInterval(UI.knob);
				var seekto = Math.floor((value * parseInt(MPD.json['time'])) / 1000);
				sendMpdCmd('seek ' + MPD.json['song'] + ' ' + seekto);

				if (SESSION.json['timecountup'] == "1" || parseInt(MPD.json['time']) == 0) {
					$('#countdown-display').countdown({since: -seekto, onTick: watchCountdown, compact: true, format: 'hMS', layout: '{h<}{hn}{sep}{h>}{mnn}{sep}{snn}'});
				} else {
					$('#countdown-display').countdown({until: seekto, onTick: watchCountdown, compact: true, format: 'hMS', layout: '{h<}{hn}{sep}{h>}{mnn}{sep}{snn}'});
				}
			}
			
			// repaint needed 
			UI.knobPainted = false;
        },
        cancel : function () {},

        draw : function () {}
    });

    // volume control knob
    $('.volumeknob').knob({
        change : function (value) {
            if (value > parseInt(SESSION.json['volwarning'])) {
		        $('#volume-warning-text').text('Volume setting ' + value + ' exceeds warning limit of ' + SESSION.json['volwarning']);
		        $('#volumewarning-modal').modal();
	            setVolume(SESSION.json['volknob'], "change"); // restore original value
			} else {
	            setVolume(value, "change"); // set new value
			}
        },

        release : function (value) {
            // not needed, results in duplicate setVolume cmds
        },
        cancel : function () {
            // never seen this event
        },
        draw : function () {
            // using "tron" skin
            if (this.$.data('skin') == 'tron') {

                var a = this.angle(this.cv)	// angle
                    , sa = this.startAngle	// previous start angle
                    , sat = this.startAngle	// start angle
                    , ea					// previous end angle
                    , eat = sat + a			// end angle
                    , r = true;

                this.g.lineWidth = this.lineWidth;

                this.o.cursor
                    && (sat = eat - 0.05)
                    && (eat = eat + 0.05);

                if (this.o.displayPrevious) {
                    ea = this.startAngle + this.angle(this.value);
                    this.o.cursor
                        && (sa = ea - 0.1)
                        && (ea = ea + 0.1);
                    this.g.beginPath();
                    this.g.strokeStyle = this.previousColor;
                    this.g.arc(this.xy, this.xy, this.radius - this.lineWidth, sa, ea, false);
                    this.g.stroke();
                }

                this.g.beginPath();
                this.g.strokeStyle = r ? this.o.fgColor : this.fgColor ;
                this.g.arc(this.xy, this.xy, this.radius - this.lineWidth, sat, eat, false);
                this.g.stroke();

                this.g.lineWidth = 2;
                this.g.beginPath();
                this.g.strokeStyle = this.o.fgColor;
                this.g.arc(this.xy, this.xy, this.radius - this.lineWidth + 10 + this.lineWidth * 2 / 3, 0, 20 * Math.PI, false);
                this.g.stroke();

                return false;
            }
        }
    });

    // toolbar
	$('#toolbar-btn').click(function() {
		// browse panel //newui move to show/hide and remove the css padding
		if ($('#open-browse-panel').hasClass('active')) {
			if ($('.btnlist-top-db').css('display') == 'none') {
		        $('.btnlist-top-db').show();
		        $('.btnlist-bottom-db').show();
			} else {
		        $('.btnlist-top-db').hide();
		        $('.btnlist-bottom-db').hide();
			}
			// search auto-focus
			if ($('#db-currentpath span').text() == '' || $('#db-currentpath span').text().substr(0, 3) == 'NAS') {
		        if (SESSION.json['autofocus'] == 'Yes') {$('#db-search-keyword').focus();}
			} else {
	        	if (SESSION.json['autofocus'] == 'Yes') {$('#rs-filter').focus();}
			}
		// library panel	
	    } else if ($('#open-library-panel').hasClass('active')) {
			if ($('.btnlist-top-lib').hasClass('hidden')) {
		        $('.btnlist-top-lib').removeClass('hidden');
		        $('#lib-content').css({"top":"80px"});
			} else {
		        $('.btnlist-top-lib').addClass('hidden');
		        $('#lib-content').css({"top":"40px"});
			}
			// search auto-focus
	        if (SESSION.json['autofocus'] == 'Yes') {$('#lib-album-filter').focus();}
		// playback panel //newui - don't think these are still relevant but...
	    } else if ($('#open-playback-panel').hasClass('active')) {
			if ($('.btnlist-top-pl').css('display') == 'none') {
		        $('.btnlist-top-pl').show();
			} else {
		        $('.btnlist-top-pl').hide();
			}
			// search auto-focus
	        if (SESSION.json['autofocus'] == 'Yes') {$('#pl-filter').focus();}
	    }
    });

	// toggle count up/down and direction icon, radio always counts up //newui - todo: maybe make sure it doesn't count the wrong way for mobile
	$('#countdown-display').click(function() {
		SESSION.json['timecountup'] == "1" ? SESSION.json['timecountup'] = "0" : SESSION.json['timecountup'] = "1"
		
		var result = sendMoodeCmd('POST', 'updcfgengine', {'timecountup': SESSION.json['timecountup']});

		// update time and direction indicator, use sendMoodeCmd('GET', 'getmpdstatus') to obtain exact elapsed time
		if (SESSION.json['timecountup'] == "1" || parseInt(MPD.json['time']) == 0) {
			refreshTimer(parseInt(sendMoodeCmd('GET', 'getmpdstatus')['elapsed']), parseInt(MPD.json['time']), MPD.json['state']); // count up
			$('#total').html(formatSongTime(MPD.json['time']) + '<i class="icon-caret-up countdown-caret"></i>');
		} else {
			refreshTimer(parseInt(MPD.json['time'] - parseInt(sendMoodeCmd('GET', 'getmpdstatus')['elapsed'])), 0, MPD.json['state']); // count down
			$('#total').html(formatSongTime(MPD.json['time']) + '<i class="icon-caret-down countdown-caret"></i>');
		}
    });

    // click on playlist entry //newui - add animation to scroll page to top if a playlist item is pressed
    $('.playlist').on('click', '.pl-entry', function() {
        var pos = $('.playlist .pl-entry').index(this);

        var cmd = MPD.json['song'] == pos ? 'stop,play ' + pos : 'play ' + pos;        

        sendMpdCmd(cmd);
        $(this).parent().addClass('active');
		if( $("#mobile-toolbar").css('display') == 'flex') {
			$('html, body').animate({ scrollTop: 0 }, 'fast');
		}
    });

	// click on playlist action menu button
    $('.playlist').on('click', '.pl-action', function() {
	    // adjust menu position so its always visible
	    var posTop = "-92px"; // new btn pos 
	    var relOfs = 212;  // btn offset relative to window
		
		if ($(window).height() - ($(this).offset().top - $(window).scrollTop()) <= relOfs) {
			$('#context-menus .dropdown-menu').css({"top":posTop}); // 3 menu items
		} else {
			$('#context-menus .dropdown-menu').css({"top":"0px"});
		}
		
        UI.dbEntry[0] = $('.playlist .pl-action').index(this); // store posn for later use by action menu selection
		// For clock radio, reuse UI.dbEntry[3] which is also used on the Browse panel 
		// radio ststion
		if ($('#pl-' + (UI.dbEntry[0] + 1) + ' .pl-entry .pll2').html().substr(0, 2) == '<i') { // has icon-microphone
			UI.dbEntry[3] = $('#pl-' + (UI.dbEntry[0] + 1) + ' .pl-entry .pll2').text();
		}
		// songfile title, artist
		else {
			var txt = $('#pl-' + (UI.dbEntry[0] + 1) + ' .pl-entry .pll2').text();
			UI.dbEntry[3] = $('#pl-' + (UI.dbEntry[0] + 1) + ' .pl-entry .pll1').text() + ', ' + txt.substr(0, (txt.indexOf('-') - 1));
		}
    });

	// save playlist
    $('#pl-btnSave').click(function(){
		var plname = $("#pl-saveName").val();

		if (plname) {
			if (~plname.indexOf('NAS') || ~plname.indexOf('RADIO') || ~plname.indexOf('SDCARD')) {
				notify('plnameerror', '');
			}
			else {
				sendMoodeCmd('GET', 'savepl&plname=' + plname,'',true);
				notify('savepl', '');
			}
		}
		else {
			notify('needplname', '');
		}
    });

    // click on browse tab //newui - set colors back to theme standard, show/hide, todo: reset search results
    $('#open-browse-panel a').click(function(){
	    $('.playback-controls').show();
        $('#toolbar-btn').removeClass('hidden');
		$('.tab-content').css({color: themeColor});
		$('.tab-content').css({backgroundColor: themeBack});
		$('#menu-top').css('color', themeMcolor);
		$('#menu-bottom').css('color', themeMcolor);
		$('#menu-top').css('background-color', themeMback);
		$('#menu-bottom').css('background-color', themeMback);
		$('#context-menu-playlist-item.dropdown-menu').css('color', themeMcolor);
		$('#context-menu-playlist-item.dropdown-menu').css('background-color', themeMback);
		$('#context-menus .dropdown-menu').css('color', themeMcolor);
		$('#context-menus .dropdown-menu').css('background-color', themeMback);
		$('#menu-top .dropdown-menu').css({color: themeMcolor});
		$('#menu-top .dropdown-menu').css({backgroundColor: themeMback});
			
    });

    // click on library tab //newui - set colors back to theme standard, show/hide, todo: reset search results
    $('#open-library-panel a').click(function(){
		$('#lib-album-filter').css('display', 'none');
	    $('.playback-controls').show();
        $('#toolbar-btn').removeClass('hidden');
		$('.tab-content').css({color: themeColor});
		$('.tab-content').css({backgroundColor: themeBack});
		$('#menu-top').css('color', themeMcolor);
		$('#menu-bottom').css('color', themeMcolor);
		$('#menu-top').css('background-color', themeMback);
		$('#menu-bottom').css('background-color', themeMback);
		$('#context-menu-playlist-item.dropdown-menu').css('color', themeMcolor);
		$('#context-menu-playlist-item.dropdown-menu').css('background-color', themeMback);
		$('#context-menus .dropdown-menu').css('color', themeMcolor);
		$('#context-menus .dropdown-menu').css('background-color', themeMback);
		$('#menu-top .dropdown-menu').css({color: themeMcolor});
		$('#menu-top .dropdown-menu').css({backgroundColor: themeMback});

        if (!libRendered) {
	        $("#lib-content").hide();
	   	    $("#lib-loader").show();
		    $.post('command/moode.php?cmd=loadlib', {}, function(data) {
		        $("#lib-loader").hide();
		        $("#lib-content").show();
		        renderLibrary(data);
		        libRendered = true;
		    }, 'json');
	    }
    });

    // click on playback tab //newui - switch to adapative colors saved to element, todo: could probably refactor to also use global variables and save the slower css manipulation, reset search results
    $('#open-playback-panel a').click(function(){
		$('.playback-controls').hide();
		$('#pl-filter').css('display', 'none');
		$('#menu-top').css('color', adaptMcolor);
		$('#menu-bottom').css('color', adaptMcolor);
		$('#menu-top').css('background-color', adaptMback);
		$('#menu-bottom').css('background-color', adaptMback);
		$('#context-menu-playlist-item .dropdown-menu').css('color', adaptMcolor);
		$('#context-menu-playlist-item .dropdown-menu').css('background-color', adaptMback);
		$('#menu-top .dropdown-menu').css({color: adaptMcolor});
		$('#menu-top .dropdown-menu').css({backgroundColor: adaptMback});
		//console.log(adaptMback);
		// tpc add back in so Playlist auto-scrolls when Playback tab clicked
        var current = parseInt(MPD.json['song']);  // scrollto when click
        customScroll('pl', current, 200);
    });
    
    // click on back btn
    $('#db-back').click(function() {
        --UI.dbPos[10];
        var path = UI.path;
        var cutpos=path.lastIndexOf("/");
        if (cutpos !=-1) {
            var path = path.slice(0,cutpos);
        }  else {
            path = '';
        }
        MpdDbCmd('filepath', path, UI.browsemode, 1);
    });

    // click on home btn
    $('#db-home').click(function() {
		$('.database li').removeClass('active');
        --UI.dbPos[10];
        var path = UI.path;
		path = '';
		MpdDbCmd('filepath', path, UI.browsemode, 1);
    });

    // click on database entry //newui - get rid of loop and inline css, use show/hide
    $('.database').on('click', '.db-browse', function() {
        $('.btnlist-top-db').show();

        if (!$(this).hasClass('sx')) {
            if ($(this).hasClass('db-folder')) {
                var path = $(this).parent().data('path');
                var entryID = $(this).parent().attr('id');
                entryID = entryID.replace('db-','');
                UI.dbPos[UI.dbPos[10]] = entryID;
                ++UI.dbPos[10];
                MpdDbCmd('filepath', path, 'file', 0);

                if (path == 'RADIO') {
	                $('#db-search').addClass('db-form-hidden');
	                $('#db-search-input').addClass('hidden');
	                $('#rs-search-input').removeClass('hidden');
	                if (SESSION.json['autofocus'] == 'Yes') {$('#rs-filter').focus();}
                } else {
	                $('#rs-search-input').addClass('hidden');
	                $('#db-search').removeClass('db-form-hidden');
	                $('#db-search-input').removeClass('hidden');
	                if (SESSION.json['autofocus'] == 'Yes') {$('#db-search-keyword').focus();}
                }

			} else if ($(this).hasClass('db-savedplaylist')) {
				var path = $(this).parent().data('path');
				var entryID = $(this).parent().attr('id');
				entryID = entryID.replace('db-','');
				UI.dbPos[UI.dbPos[10]] = entryID;
				++UI.dbPos[10];
				MpdDbCmd('listsavedpl', path, 'file', 0);
				// TC (Tim Curtis) 2015-01-01: typedown search
				// TC (Tim Curtis) 2015-01-27: set focus to search field
                $('#db-search').addClass('db-form-hidden');
                $('#db-search-input').addClass('hidden');
                $('#rs-search-input').removeClass('hidden');
                if (SESSION.json['autofocus'] == 'Yes') {$('#rs-filter').focus();}
			}
        }
    });

    // click on browse action menu button
    $('.database').on('click', '.db-action', function() {
        UI.dbEntry[0] = $(this).parent().attr('data-path');
		UI.dbEntry[3] = $(this).parent().attr('id'); // used in .context-menu a click handler to remove highlight
        $('.database li').removeClass('active');
        $(this).parent().addClass('active');
        
		// adjust menu position so its always visible
	    var posTop = ''; // new btn pos
	    var relOfs = 0;  // btn offset relative to window
		var menuId = $('.db-action a').attr('data-target');
		
		if (menuId == '#context-menu-savedpl-item' || menuId == '#context-menu-folder-item') { // 3 menu items
			posTop = '-92px';
			relOfs = 212;	
		} else if (menuId == '#context-menu' || menuId == '#context-menu-root') { // 4 menu items	
			posTop = '-132px';
			relOfs = 252;	
		} else if (menuId == '#context-menu-radio-item') { // 6 menu items
			posTop = '-212px';
			relOfs = 332;	
		}
		
		if ($(window).height() - ($(this).offset().top - $(window).scrollTop()) <= relOfs) {
			$('#context-menus .dropdown-menu').css({"top":posTop});
		} else {
			$('#context-menus .dropdown-menu').css({"top":"0px"});
		}        
    });

    // chiudi i risultati di ricerca nel DB
    $('.database').on('click', '.search-results', function() {
        MpdDbCmd('filepath', UI.path);
    });

    // click on action menu or main menu items
    $('.context-menu a').click(function(){
        var path = UI.dbEntry[0]; // File path or item num

        if ($(this).data('cmd') == 'add') {
            MpdDbCmd('add', path);
            notify('add', '');
        } 

        if ($(this).data('cmd') == 'play') {
            MpdDbCmd('play', path);
            notify('add', '');
        }

        if ($(this).data('cmd') == 'clrplay') {
            MpdDbCmd('clrplay', path);
            notify('clrplay', '');

            if (path.indexOf("/") == -1) {  // its a playlist, preload the saved playlist name
	            $("#pl-saveName").val(path);
            } else {
	            $("#pl-saveName").val("");
			}
        }
        
        if ($(this).data('cmd') == 'update') {
            MpdDbCmd('update', path);
            notify('update', path);
            libRendered = false;
        }

        if ($(this).data('cmd') == 'delsavedpl') {
			$('#savedpl-path').html(path);        	        
	        $('#deletesavedpl-modal').modal();
        }

        if ($(this).data('cmd') == 'delstation') {
			// trim "RADIO/" and ".pls" from path
			$('#station-path').html(path.slice(0,path.lastIndexOf(".")).substr(6));
	        $('#deletestation-modal').modal();
        }

        if ($(this).data('cmd') == 'addstation') {
			$('#add-station-name').val("New Station");
			$('#add-station-url').val("http://");
	        $('#addstation-modal').modal();
        }

        if ($(this).data('cmd') == 'editradiostn') {
	        // trim "RADIO/" and ".pls" from path
			path = path.slice(0,path.lastIndexOf(".")).substr(6);
			$('#edit-station-name').val(path);
			$('#edit-station-url').val(sendMoodeCmd('POST', 'readstationfile', {'path': UI.dbEntry[0]})['File1']);
	        $('#editstation-modal').modal();
        }
 
        if ($(this).data('cmd') == 'deleteplitem') {
			// max value (num pl items in list)
			$('#delete-plitem-begpos').attr('max', UI.dbEntry[4]);
			$('#delete-plitem-endpos').attr('max', UI.dbEntry[4]);
			$('#delete-plitem-newpos').attr('max', UI.dbEntry[4]);
			// num of selected item
			$('#delete-plitem-begpos').val(path + 1);
			$('#delete-plitem-endpos').val(path + 1);
	        $('#deleteplitems-modal').modal();
        }
 
        if ($(this).data('cmd') == 'moveplitem') {
			// max value (num pl items in list)
			$('#move-plitem-begpos').attr('max', UI.dbEntry[4]);
			$('#move-plitem-endpos').attr('max', UI.dbEntry[4]);
			$('#move-plitem-newpos').attr('max', UI.dbEntry[4]);
			// num of selected item
			$('#move-plitem-begpos').val(path + 1);
			$('#move-plitem-endpos').val(path + 1);
			$('#move-plitem-newpos').val(path + 1);
	        $('#moveplitems-modal').modal();
        }
		
		// remove row highlight after selecting action menu item (Browse)
		if (UI.dbEntry[3].substr(0, 3) == 'db-') {
			$('#' + UI.dbEntry[3]).removeClass('active');
		}
    });
    
	// click on various buttons
    $('.btn-del-savedpl').click(function(){
		MpdDbCmd('delsavedpl', UI.dbEntry[0]);
		notify('delsavedpl', '');
	});

    $('.btn-del-radiostn').click(function(){
		MpdDbCmd('delstation', UI.dbEntry[0]);
		notify('delstation', '');
	});

    $('.btn-add-radiostn').click(function(){
		MpdDbCmd('addstation', $('#add-station-name').val() + "\n" + $('#add-station-url').val() + "\n");
		notify('addstation', '');
	});

    $('.btn-update-radiostn').click(function(){
		MpdDbCmd('updstation', $('#edit-station-name').val() + "\n" + $('#edit-station-url').val() + "\n");
		notify('updstation', '');
	});

    $('.btn-delete-plitem').click(function(){
		var cmd = '';
	    var begpos = $('#delete-plitem-begpos').val() - 1;
	    var endpos = $('#delete-plitem-endpos').val() - 1;
		// NOTE: format for single or multiple, endpos not inclusive so must be bumped for multiple
	    begpos == endpos ? cmd = 'delplitem&range=' + begpos : cmd = 'delplitem&range=' + begpos + ':' + (endpos + 1);
        notify('remove', '');
        sendMoodeCmd('GET', cmd,'',true); // async
	});

	// speed btns on delete modal
    $('#btn-delete-setpos-top').click(function(){
		$('#delete-plitem-begpos').val(1);
		return false;
	});

    $('#btn-delete-setpos-bot').click(function(){
		$('#delete-plitem-endpos').val(UI.dbEntry[4]);
		return false;
	});

    $('.btn-move-plitem').click(function(){
		var cmd = '';
	    var begpos = $('#move-plitem-begpos').val() - 1;
	    var endpos = $('#move-plitem-endpos').val() - 1;
	    var newpos = $('#move-plitem-newpos').val() - 1;
		// NOTE: format for single or multiple, endpos not inclusive so must be bumped for multiple
		// move begpos newpos or move begpos:endpos newpos 
	    begpos == endpos ? cmd = 'moveplitem&range=' + begpos + '&newpos=' + newpos : cmd = 'moveplitem&range=' + begpos + ':' + (endpos + 1) + '&newpos=' + newpos;
        notify('move', '');
        sendMoodeCmd('GET', cmd,'',true); // async
	});

	// speed btns on move modal
    $('#btn-move-setpos-top').click(function(){
		$('#move-plitem-begpos').val(1);
		return false;
	});

    $('#btn-move-setpos-bot').click(function(){
		$('#move-plitem-endpos').val(UI.dbEntry[4]);
		return false;
	});

    $('#btn-move-setnewpos-top').click(function(){
		$('#move-plitem-newpos').val(1);
		return false;
	});

    $('#btn-move-setnewpos-bot').click(function(){
		$('#move-plitem-newpos').val(UI.dbEntry[4]);
		return false;
	});
	
	// remove highlight when clicking off-row
    $('.database').on('click', '.db-song', function() {
        $('.database li').removeClass('active');
    });

	// save playlist modal //newui - add click handler for playlist save button
    $('#playlistSave').click(function() {
		$('#savepl-modal').modal();
	});
	    
    // page nav buttons
    $('.db-firstPage').click(function(){
        $('#database').scrollTo(0 , 500);
    });

    $('.db-lastPage').click(function(){
        $('#database').scrollTo('100%', 500);
    });

    $('.db-prevPage').click(function(){
        var scrolloffset = '-=' + $(window).height() + 'px';
        $.scrollTo(scrolloffset , 500);
    });

    $('.db-nextPage').click(function(){
        var scrolloffset = '+=' + $(window).height() + 'px';
        $.scrollTo(scrolloffset , 500);
    });

    $('.pl-firstPage').click(function(){
        $('#container-playlist').scrollTo(0 , 500);
    });

    $('.pl-lastPage').click(function(){
        $('#container-playlist').scrollTo('100%', 500);
    });

    $('.pl-prevPage').click(function(){
        var scrollTop = $(window).scrollTop();
        var scrolloffset = scrollTop - $(window).height();
        $.scrollTo(scrolloffset , 500);
    });

    $('.pl-nextPage').click(function(){
        var scrollTop = $(window).scrollTop();
        var scrolloffset = scrollTop + $(window).height();
        $.scrollTo(scrolloffset , 500);
    });

	// speed buttons on plaback history log
    $('.ph-firstPage').click(function(){
        $('#container-playhistory').scrollTo(0 , 500);
    });

    $('.ph-lastPage').click(function(){
        $('#container-playhistory').scrollTo('100%', 500);
    });

	// speed buttons on Customize popup
    $('.cs-firstPage').click(function(){
        $('#container-customize').scrollTo(0 , 500);
    });

    $('.cs-lastPage').click(function(){
        $('#container-customize').scrollTo('100%', 500);
    });

    // open a tab from external link
    var url = document.location.toString();
    if (url.match('#')) {
        $('#menu-bottom a[href=#'+url.split('#')[1]+']').tab('show') ;
    }
    
	// NOTE is this needed ?
    // don't scroll w html5 history api
    $('#menu-bottom a').on('shown', function (e) {
        if(history.pushState) {
            history.pushState(null, null, e.target.hash);
        } else {
            window.location.hash = e.target.hash; // polyfill for old browsers
        }
    });

    // library typedown search //newui - add click handler for magnifying glass button in library

    $('#lib-search').click(function(e){		
		if ($('#lib-album-filter').css('display') == 'inline-block') {
			$('#lib-album-filter').hide();
		    $("input").blur();
			$("#lib-album-filter").val("");
			$('.btnlist-top-lib').css('width', '50px');
			$('.home.playback-controls.playback-controls-sm').toggle();
			clickedLibItem(e, undefined, LIB.filters.artists, renderArtists);
		}
		else {
			$('#lib-album-filter').show();
			$('.btnlist-top-lib').css('width', '300px');
			$('#lib-album-filter').focus();
			$('.home.playback-controls.playback-controls-sm').toggle();
		}	
		$('#lib-album-filter-results').toggle();
	});
	
    // playback typedown search //newui - add click handler for magnifying glass button in playback

	$('#play-search').click(function(){
		if ($('#pl-filter').css('display') == 'inline-block') {
			$('#pl-filter').css('display', 'none');
		    $("input").blur();
			$("#pl-filter").val("");
		}
		else {
			$('#pl-filter').css('display', 'inline-block');
			$('#pl-filter').focus();
		}	
	});

    $("#pl-filter").keyup(function(){
        $.scrollTo(0 , 500);
        var filter = $(this).val(), count = 0;
        
        $(".playlist li").each(function(){
            if ($(this).text().search(new RegExp(filter, "i")) < 0) {
                $(this).hide();
            } else {
                $(this).show();
                count++;
            }
        });

        var s = (count == 1) ? '' : 's';

        if (filter != '') {
            $('#pl-filter-results').html((+count) + '&nbsp;item' + s);
        } else {
            $('#pl-filter-results').html('');
        }
    });

    // radio station typedown search
    $("#rs-filter").keyup(function(){
        $.scrollTo(0 , 500);
        var filter = $(this).val(), count = 0;

        $(".database li").each(function(){
            if ($(this).text().search(new RegExp(filter, "i")) < 0) {
                $(this).hide();
            } else {
                $(this).show();
                count++;
            }
        });

        var s = (count == 1) ? '' : 's';
        if (filter != '') {
            $('#db-filter-results').html((+count) + '&nbsp;station' + s);
        } else {
            $('#db-filter-results').html('');
        }
    });

	// library typedown search
    $("#lib-album-filter").keyup(function(){
        $.scrollTo(0 , 500);
        var filter = $(this).val(), count = 0;
        
        $(".albumslist li").each(function() {
            if ($(this).text().search(new RegExp(filter, "i")) < 0) {
                $(this).hide();
            } else {
                $(this).show();
                count++;
            }
        });
        
        var s = (count == 1) ? '' : 's';
        if (filter != '') {
            $('#lib-album-filter-results').html((+count) + '&nbsp;album' + s);
        } else {
            $('#lib-album-filter-results').html('');
        }
    });

    // playback history typedown search
    $("#ph-filter").keyup(function(){
        $.scrollTo(0 , 500);
        var filter = $(this).val(), count = 0;
        
        $(".playhistory li").each(function(){
            if ($(this).text().search(new RegExp(filter, "i")) < 0) {
                $(this).hide();
            } else {
                $(this).show();
                count++;
            }
        });
        
        var s = (count == 1) ? '' : 's';
        if (filter != '') {
            $('#ph-filter-results').html((+count) + '&nbsp;item' + s);
        } else {
            $('#ph-filter-results').html('');
        }
    });

	// browse panel //newui - show/hide, make sure theme colors are active
    if ($('#open-browse-panel').hasClass('active')) {
		$('.playback-controls').show();
        $('#toolbar-btn').removeClass('hidden');
		setColors();
    }
    // library panel //newui - show/hide, make sure theme colors are active
	else if ($('#open-library-panel').hasClass('active')) {
		$('#lib-album-filter').hide();
		$('.playback-controls').show();	
		setColors();
    }
	// playback panel //newui 
	else if ($('#open-playback-panel').hasClass('active')) {		
		$('.playback-controls').hide();
		$('#pl-filter').hide();
		$('#playlistSave').hide();
		$('#menu-top').css('color', adaptMcolor);
		$('#menu-bottom').css('color', adaptMcolor);
		$('#menu-top').css('background-color', adaptMback);
		$('#menu-bottom').css('background-color', adaptMback);
		$('#context-menu-playlist-item .dropdown-menu').css({color: adaptMcolor});
		$('#context-menu-playlist-item .dropdown-menu').css({backgroundColor: adaptMback});
		$('#menu-top .dropdown-menu').css({color: adaptMcolor});
		$('#menu-top .dropdown-menu').css({backgroundColor: adaptMback});
		// TEST
        var current = parseInt(MPD.json['song']);
        customScroll('pl', current, 200);
	}

	// control when library loads
	if ($('#open-library-panel').hasClass('active')) {
	    $("#lib-loader").show();
	    $.post('command/moode.php?cmd=loadlib', {}, function(data) {
	        $("#lib-loader").hide();
	        $("#lib-content").show();
	        renderLibrary(data);
	        libRendered = true;
	    }, 'json');
    }

});

// info show/hide toggle
$('.info-toggle').click(function() {
	var spanId = '#' + $(this).data('cmd');
	if ($(spanId).hasClass('hide')) {
		$(spanId).removeClass('hide');
	} else {
		$(spanId).addClass('hide');
	}
});
