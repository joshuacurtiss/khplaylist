const moment=require("moment");
require("moment-duration-format");

class WebVTT {

    constructor(data) {
        this.data=data;
        return this;
    }

    get data() {return this._data}
    set data(data) {
        if( typeof data=="string" ) {
            this.data=this.parseWebVTT(data);
        } else if( typeof data=="object" && Array.isArray(data) ) {
            this._data=this.sanitize(data);
        } else {
            console.error(`You cannot set data to ${typeof data}.`);
        }
    }

    sanitize(arr) {
        var out=[];
        if( Array.isArray(arr) ) {
            for( var o of arr ) {
                if( typeof o == "object" ) {
                    out.push({
                        id: o.id || "",
                        start: o.start || 0,
                        end: o.end || 0,
                        content: o.content || o.name || ""
                    });
                }
            }
        }
        return out;
    }

    parseWebVTT(data) {
        var srt, i, cues=[];
        // check WEBVTT identifier
        if (data.substring(0, 6) != "WEBVTT") {
            console.warn("Missing WEBVTT header: Not a WebVTT file - trying SRT.");
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
                if(s.length>1) t = 1;
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

    toString() {
        var id, chdata, webvtt="WEBVTT";
        for( id in this.data ) {
            chdata=this.data[id];
            webvtt+=`\n\n${id}`;
            webvtt+=`\n${moment.duration(parseInt(chdata.start*1000)).format(WebVTT.TIMEFMT,WebVTT.TIMEOPTS)} --> `;
            webvtt+=`${moment.duration(parseInt(chdata.end*1000)).format(WebVTT.TIMEFMT,WebVTT.TIMEOPTS)}`;
            webvtt+=`\n${chdata.content}`;
        }
        return webvtt;
    }

}

WebVTT.TIMEFMT="HH:mm:ss.SSS";
WebVTT.TIMEOPTS={forceLength:true, trim:false};

module.exports=WebVTT;