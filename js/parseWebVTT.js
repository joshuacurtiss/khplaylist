function parseWebVTT(data) {
    var srt;
    // check WEBVTT identifier
    if (data.substring(0, 6) != "WEBVTT") {
        alert("Missing WEBVTT header: Not a WebVTT file - trying SRT.");
        srt = data;
    } else {
        // remove WEBVTT identifier line
        srt = data.split('\n').slice(1).join('\n');
    }

    // clean up string a bit
    srt = srt.replace(/\r+/g, ''); // remove dos newlines
    srt = srt.replace(/^\s+|\s+$/g, ''); // trim white space start and end

    //    srt = srt.replace(/<[a-zA-Z\/][^>]*>/g, ''); // remove all html tags for security reasons

    // parse cues
    var cuelist = srt.split('\n\n');
    for (i = 0; i < cuelist.length; i++) {
        var cue = cuelist[i];
        var content = "",
            start, end, id = "";
        var s = cue.split(/\n/);
        var t = 0;
        // is there a cue identifier present?
        if (!s[t].match(/(\d+):(\d+):(\d+)/)) {
            // cue identifier present
            id = s[0];
            t = 1;
        }
        // is the next line the time string
        if (!s[t].match(/(\d+):(\d+):(\d+)/)) {
            // file format error: next cue
            continue;
        }
        // parse time string
        var m = s[t].match(/(\d+):(\d+):(\d+)(?:.(\d+))?\s*--?>\s*(\d+):(\d+):(\d+)(?:.(\d+))?/);
        if (m) {
            start =
                (parseInt(m[1], 10) * 60 * 60) +
                (parseInt(m[2], 10) * 60) +
                (parseInt(m[3], 10)) +
                (parseInt(m[4], 10) / 1000);
            end =
                (parseInt(m[5], 10) * 60 * 60) +
                (parseInt(m[6], 10) * 60) +
                (parseInt(m[7], 10)) +
                (parseInt(m[8], 10) / 1000);
        } else {
            // Unrecognized timestring: next cue
            continue;
        }

        // concatenate text lines to html text
        content = s.slice(t + 1).join("<br>");

        // add parsed cue
        cues.push({
            id: id,
            start: start,
            end: end,
            content: content
        });
    }
    return cues;
}
module.exports=parseWebVTT;