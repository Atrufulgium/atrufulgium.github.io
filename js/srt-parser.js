// Modified from https://gist.github.com/korny/c31e1017b2e23c2f4042
// Licensed under uhhhhhh good faith? None listed.

/** @param {string} time Must be formatted HH:MM:SS,mmm */
function srtTimeToSeconds(time) {
    let match = time.match(/(\d\d):(\d\d):(\d\d),(\d\d\d)/);
    let hours        = +match[1],
        minutes      = +match[2],
        seconds      = +match[3],
        milliseconds = +match[4];
    
    return (hours * 60 * 60) + (minutes * 60) + (seconds) + (milliseconds / 1000);
}

/**
 * @typedef Subtitle
 * @type {object}
 * @property {number} start The start timestamp, in seconds.
 * @property {number} end   The end timestamp, in seconds.
 * @property {string} text  The contents of this subtitle.
 */

/**
 * @param {string} line Parses a correctly formatted single SRT entry, from ID to time to text.
 * @returns {Subtitle}  The subtitle this SRT entry represents.
 * */
function parseSrtLine(line) {
    let match = line.match(/(\d\d:\d\d:\d\d,\d\d\d) --> (\d\d:\d\d:\d\d,\d\d\d)\n([\S\s]*)/m);
    
    return {
      start: srtTimeToSeconds(match[1]),
      end:   srtTimeToSeconds(match[2]),
      text:  match[3].trim()
    };
}
  
/**
 * @param {string} file  Parses a correctly formatted SRT file into an array of SRT entries.
 * @returns {Subtitle[]} A list of all subtitles in the SRT file.
 */
function parseSrt(file) {
    /** @type {string[]} */
    // @ts-ignore
    let lines = file.replaceAll('\r', '').split(/(?:^|\n\n)\d+\n|\n+$/g).slice(1, -2);
    
    return lines.map(parseSrtLine);
}

/** Gets the unique subtitle, if any, that's active at a given moment.
 * @param {Subtitle[]} srt   The subtitles to search. These may not overlap.
 * @param {number} timestamp The timestamp, in seconds.
 * @returns {string}
 */
function getSubtitleAtTime(srt, timestamp) {
    // can't believe binary search is not part of the standard library
    let low = 0;
    let upp = srt.length;
    let lowequalsupiters = 0;
    while (true) {
        let half = (low + upp) >> 1;
        if (timestamp < srt[half].start) {
            upp = half;
        } else {
            if (timestamp < srt[half].end) {
                return srt[half].text;
            }
            // Early return if inbetween subtitles
            // (Note `number < undefined` is false.)
            if (timestamp < srt[half + 1].start) {
                return "";
            }

            low = half;
        }

        // it's 12am I'm lazy I'm not gonna think
        if (low === upp)
            lowequalsupiters++;
        if (lowequalsupiters >= 2)
            return "";
    }
}