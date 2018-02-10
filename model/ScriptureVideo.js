const Cue=require("./Cue");
const Scripture=require("scripture/Scripture");
const WebVTT=require("webvtt/lib/WebVTT");

class ScriptureVideo {

    constructor(scripture,path,webvtt) {
        this.displayName="";
        this.path=path;
        this.webvtt=webvtt;
        this.scripture=scripture; // Must be set after webvtt is set.
        this.pathIsIndexed=true;
        return this;
    }

    get webvtt() {return this._webvtt}
    set webvtt(webvtt) {
        if( webvtt instanceof WebVTT ) this._webvtt=webvtt;
        else this._webvtt=new WebVTT(webvtt);
        // Sanitization, remove hidden control characters from cue content: 
        this._webvtt.data.map(obj=>obj.content=obj.content.replace(/[^\u{0020}-\u{FFFF}]/gu,""));
    }

    get scripture() {return this._scripture}
    set scripture(scripture) {
        this._scripture=scripture;
        this.displayName=this.source.toString();
        var list=[];
        if( scripture.valid() ) {
            var cue;
            for( var v of scripture.verses ) {
                cue=this.getCueByVerse(v);
                if(cue) {
                    if( list.length && list[list.length-1].end==cue.start ) {
                        var last=list[list.length-1];
                        last.end=cue.end;
                        last.max=cue.end;
                        last.content=last.content.split("-")[0]+"-"+cue.content.split(":")[1];
                    } else {
                        list.push(new Cue(cue.start,cue.end,cue.content));
                    }
                }
            }
        }
        this.list=list;
    }

    get source() {return this.scripture}
    get filename() {return path.basename(this.path)}
    get extension() {return path.extname(this.path).toLowerCase()}

    isImage() {return false}
    isVideo() {return true}

    calcPlayLength() {
        var sum=0;
        for( var cue of this.list ) sum+=cue.end-cue.start;
        return sum;
    }

    getCueByVerse(verse) {
        var verseRegex=new RegExp(`\\b${verse}\\s*$`);
        return this.webvtt.data.find(c=>verseRegex.test(c.content));
    }

}

module.exports=ScriptureVideo;