const Publication=require("../bower_components/theoreference/Publication");
const Reference=require("../bower_components/theoreference/Reference");
const WebVTT=require("../bower_components/webvtt/lib/WebVTT");

class ReferenceVideo {

    constructor(reference,path,webvtt) {
        this.path=path;
        this.webvtt=webvtt;
        // Pass cues to reference after webvtt is set.
        reference.availableCues=this.webvtt.data;
        this.reference=reference;
        return this;
    }

    get displayName() {return this.reference.toString()}

    get webvtt() {return this._webvtt}
    set webvtt(webvtt) {
        if( webvtt instanceof WebVTT ) this._webvtt=webvtt;
        else this._webvtt=new WebVTT(webvtt);
    }

    get reference() {return this._reference}
    set reference(reference) {
        this._reference=reference;
        if( reference.valid() ) {
            var list=[];
            var cue;
            for( var cuename of reference.cues ) {
                cue=this.getCueByName(cuename);
                if( list.length && list[list.length-1].end==cue.start ) {
                    var last=list[list.length-1];
                    last.end=cue.end;
                    last.content=last.content.split("-")[0]+"-"+cue.content;
                } else {
                    list.push({start:cue.start,end:cue.end,content:cue.content});
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

    getCueByName(cuename) {
        return cue=this.webvtt.data.find(item=>item.content.toLowerCase()==cuename.toLowerCase());
    }
}

module.exports=ReferenceVideo;