const Cue=require("./Cue");
const Publication=require("../bower_components/theoreference/Publication");
const Reference=require("../bower_components/theoreference/Reference");
const WebVTT=require("../bower_components/webvtt/lib/WebVTT");

class ReferenceVideo {

    constructor(reference,path,webvtt) {
        this.displayName="";
        this.path=path;
        this.webvtt=webvtt;
        // Pass cues to reference after webvtt is set.
        reference.availableCues=this.webvtt.data;
        this.reference=reference;
        this.pathIsIndexed=true;
        return this;
    }

    get webvtt() {return this._webvtt}
    set webvtt(webvtt) {
        if( webvtt instanceof WebVTT ) this._webvtt=webvtt;
        else this._webvtt=new WebVTT(webvtt);
    }

    get reference() {return this._reference}
    set reference(reference) {
        this._reference=reference;
        this.displayName=this.source.toString();
        if( reference.valid() ) {
            var list=[];
            var cue;
            for( var cueid of reference.cues ) {
                cue=this.getCueById(cueid);
                if( list.length && list[list.length-1].end==cue.start ) {
                    var last=list[list.length-1];
                    last.end=cue.end;
                    last.max=cue.end;
                    last.content=last.content.split("-")[0]+"-"+cue.content;
                } else {
                    list.push(new Cue(cue.start,cue.end,cue.content));
                }
            }
            this.list=list;
        }
    }

    get source() {return this.reference}
    get filename() {return path.basename(this.path)}
    get extension() {return path.extname(this.path).toLowerCase()}

    isImage() {return false}
    isVideo() {return true}

    calcPlayLength() {
        var sum=0;
        for( var cue of this.list ) sum+=cue.end-cue.start;
        return sum;
    }

    getCueByName(cuename) {
        return this.webvtt.data.find(item=>item.content.toLowerCase()==cuename.toLowerCase());
    }
    
    getCueById(cueid) {
        return this.webvtt.data[cueid];
    }
    
}

module.exports=ReferenceVideo;