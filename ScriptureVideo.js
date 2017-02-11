const Scripture=require("./Scripture.js");
const WebVTT=require("./WebVTT");

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
        this._webvtt=new WebVTT(webvtt);
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
        return this.webvtt.data.find((c)=>{return verseRegex.test(c.content)});
    }

}

module.exports=ScriptureVideo;