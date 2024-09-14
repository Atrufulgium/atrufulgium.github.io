window.addEventListener("DOMContentLoaded", function(e) {
    requestAnimationFrame(step);
});

/** @type {DOMHighResTimeStamp} */
let start;

/** @param {DOMHighResTimeStamp} timestamp */
function step(timestamp) {
    if (start === undefined) {
        start = timestamp;
    }
    let progress_seconds = (timestamp - start) / 1000;

    // 3 fps. The 1600 is the lcm of 160px width, and the three different speeds 5x, 2x, 1x.
    let bg_anim_offset = Math.floor(3 * progress_seconds) % 1600;
    document.body.style.setProperty("--anim-offset", bg_anim_offset.toString());
    // After 22 frames of offset, we're at an empty frame, so don't move past that.
    let azzy_offset = Math.min(Math.floor(10 * progress_seconds), 22);
    document.body.style.setProperty("--azachon-anim-offset", azzy_offset.toString());

    requestAnimationFrame(step);
}