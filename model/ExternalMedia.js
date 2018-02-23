const path=require("path");
const fs=require("fs-extra");
const Cue=require("./Cue");
const WebVTT=require("webvtt/lib/WebVTT");

class ExternalMedia {

    constructor(path,webvtt) {
        this.pathIsIndexed=false;
        this.displayName="";
        this.webvtt=webvtt;
        this.path=path;
        return this;
    }

    get pathIsIndexed() {return this._pathIsIndexed}
    set pathIsIndexed(newvalue) {
        this._pathIsIndexed=newvalue;
        this.displayName=this.pathIsIndexed?path.basename(this.path):this.path;
    }

    get path() {return this._path}
    set path(path) {
        this._path=path;
        this.displayName=this.pathIsIndexed?path.basename(this.path):this.path;
        this.createList();
    }

    get webvtt() {return this._webvtt}
    set webvtt(webvtt) {
        if( webvtt instanceof WebVTT ) this._webvtt=webvtt;
        else this._webvtt=new WebVTT(webvtt);
        // Sanitization, remove hidden control characters from cue content: 
        this._webvtt.data.map(obj=>obj.content=obj.content.replace(/[^\u{0020}-\u{FFFF}]/gu,""));
        this.createList();
    }

    get source() {return this}
    get filename() {return path.basename(this.path)}
    get extension() {return path.extname(this.path).toLowerCase()}

    isImage() {return (ExternalMedia.IMAGEEXT.indexOf(this.extension)>=0)}
    isVideo() {return (ExternalMedia.VIDEOEXT.indexOf(this.extension)>=0)}
    valid() {return this.path && this.path.length && fs.existsSync(this.path)}

    createList() {
        var list=[];
        if( this.valid() && this.isVideo() ) {
            this.webvtt.data.forEach(cue=>{
                if( list.length && list[list.length-1].end==cue.start ) {
                    var last=list[list.length-1];
                    last.end=cue.end;
                    last.max=cue.end;
                    last.content=last.content.split("-")[0]+"-"+cue.content;
                } else {
                    list.push(new Cue(cue.start,cue.end,cue.content));
                }
            });
        }
        this.list=list;
    }

    calcPlayLength() {
        var sum=this.isImage()?ExternalMedia.IMAGE_DURATION:0;
        for( var cue of this.list ) sum+=cue.end-cue.start;
        return sum;
    }

    toString() {return this.pathIsIndexed?this.filename:this.path}

}

ExternalMedia.IMAGE_DURATION=6;
ExternalMedia.IMAGEEXT=[".png",".jpg",".gif",".jpeg",".bmp"];
ExternalMedia.VIDEOEXT=[".mov",".mp4",".m4v",".avi",".webm"];
ExternalMedia.ALLEXT=ExternalMedia.IMAGEEXT.concat(ExternalMedia.VIDEOEXT);

module.exports=ExternalMedia;