/** @type {HTMLElement} */
let subs_element;
/** @type {HTMLElement} */
let menu_element;
window.addEventListener("DOMContentLoaded", function(e) {
    subs_element = document.getElementById("subs");
    menu_element = document.getElementById("menu");
});

let player;
// https://developers.google.com/youtube/iframe_api_reference#Playback_controls
function onYouTubeIframeAPIReady() {
    // @ts-ignore
    player = new YT.Player("FFoF-yt-player", {
        events: {
            "onReady": playerReady,
            "onError": playerError
        }
    })
}

/** @type {Subtitle[]} */
let srt;
let ready = false;
function playerReady() {
    ready = true;
    srt = parseSrt(subs);
    requestAnimationFrame(step);
    menu_element.innerHTML = "<p>Tap to play/pause.</p>";
}

function playerError(error) {
    alert(`Welp something went wrong, reload the page or something?\n(Atru, don't put this in production!)\nError code ${error}.`);
}

function handleClick() {
    if (!ready || !player) { return; }
    menu_element.innerHTML = "";
    let state = player.getPlayerState();
    //  Unstarted      Ended         Paused        Cued
    if (state == -1 || state == 0 || state == 2 || state == 5) {
        player.playVideo();
        //     Playing       Buffering
    } else if (state == 1 || state == 3) {
        player.pauseVideo();
    }
}

function getTime() {
    if (!player || !player.getCurrentTime) {
        return 0;
    }
    return player.getCurrentTime();
}

/** Start timestamps of each track. */
const starts = [0,131,234,338,435,503,602,708,825,958,1066,1183,1309,1418,1528,1664,1783,1886,2000,2132,2298,2449,2570,2699,2831,2994,3499];
/** Gets the current track ID.
 * @param {number} timestamp Current timestamp in seconds.
 * @returns {number} Integer [0,26] specifying track index.
 */
function getTrack(timestamp) {
    for (let i = 0; i < starts.length; i++) {
        if (timestamp < starts[i])
            return i - 1;
    }
    return starts.length - 1;
}

/** Background IDs of each track. */
const backgrounds = [0,1,1,2,2,3,3,4,4,4,5,6,7,7,8,9,10,10,11,11,11,9,12,12,13,13,14];

function step() {
    let progress_seconds = getTime();

    // 3 fps. The 1600 is the lcm of 160px width, and the three different speeds 5x, 2x, 1x.
    let bg_anim_offset = Math.floor(3 * progress_seconds) % 1600;
    document.body.style.setProperty("--anim-offset", bg_anim_offset.toString());
    // After 22 frames of offset, we're at an empty frame, so don't move past that.
    let azzy_offset = Math.min(Math.floor(10 * progress_seconds), 22);
    document.body.style.setProperty("--azachon-anim-offset", azzy_offset.toString());

    // Update track info
    let track_id = getTrack(progress_seconds);
    document.body.style.setProperty("--title-id", track_id.toString());
    let background_id = backgrounds[track_id];
    document.body.style.setProperty("--background-id", background_id.toString());

    // Update subs
    subs_element.innerHTML = getSubtitleAtTime(srt, progress_seconds);

    requestAnimationFrame(step);
}