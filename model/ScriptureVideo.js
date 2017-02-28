const Scripture=require("../bower_components/scripture/Scripture");
const WebVTT=require("../bower_components/webvtt/lib/WebVTT");

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
        if( webvtt instanceof WebVTT ) this._webvtt=webvtt;
        else this._webvtt=new WebVTT(webvtt);
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

    calcPlayLength() {
        var sum=0;
        for( var cue of this.list ) sum+=cue.end-cue.start;
        return sum;
    }

    calcPlayPercentage(index,pos) {
        var sum=0;
        if( index>0 ) for( var i=0 ; i<index ; i++ ) sum+=this.list[i].end-this.list[i].start;
        sum+=pos-this.list[index].start;
        var pct=parseInt(100*sum/this.calcPlayLength());
        if(pct>100) pct=100; 
        else if( pct<0 ) pct=0;
        return pct;
    }

    getCueByVerse(verse) {
        var verseRegex=new RegExp(`\\b${verse}$`);
        return this.webvtt.data.find((c)=>{return verseRegex.test(c.content)});
    }

}

module.exports=ScriptureVideo;