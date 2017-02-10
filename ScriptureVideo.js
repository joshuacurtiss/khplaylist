let Scripture=require("./Scripture.js");

class ScriptureVideo {

    constructor(scripture,path,webvtt) {
        this.path=path;
        this.webvtt=webvtt;
        this.scripture=scripture; // Must be set after webvtt is set.
        return this;
    }

    get displayName() {return this.scripture.toString()}

    get webvtt() {return this._webvtt}
    set webvtt(webvtt) {
        this._webvtt=webvtt;
        this.cues=this.parseWebVTT(webvtt);
    }

    get scripture() {return this._scripture}
    set scripture(scripture) {
        this._scripture=scripture;
        if( scripture.valid() ) {
            var list=[];
            var cue;
            for( var v of scripture.verses ) {
                cue=this.getCueByVerse(v);
                if(cue) {
                    if( list.length && list[list.length-1].end==cue.start ) {
                        var last=list[list.length-1];
                        last.end=cue.end;
                        last.content=last.content.split("-")[0]+"-"+cue.content.split(":")[1];
                    } else {
                        list.push({start:cue.start,end:cue.end,content:cue.content});
                    }
                }
            }
            this.list=list;
        }
    }

    getCueByVerse(verse) {
        var verseRegex=new RegExp(`\\b${verse}$`);
        return this.cues.find((c)=>{return verseRegex.test(c.content)});
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

}

module.exports=ScriptureVideo;