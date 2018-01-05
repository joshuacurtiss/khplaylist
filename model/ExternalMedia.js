const path=require("path");
const fs=require("fs-extra");
const WebVTT=require("../bower_components/webvtt/lib/WebVTT");

class ExternalMedia {

    constructor(path,webvtt) {
        this.webvtt=webvtt;
        this.path=path;
        this.pathIsIndexed=false;
        return this;
    }

    get displayName() {return this.pathIsIndexed?path.basename(this.path):this.path}

    get path() {return this._path}
    set path(path) {
        this._path=path;
        this.createList();
    }

    get webvtt() {return this._webvtt}
    set webvtt(webvtt) {
        if( webvtt instanceof WebVTT ) this._webvtt=webvtt;
        else this._webvtt=new WebVTT(webvtt);
        this.createList();
    }

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
                    last.content=last.content.split("-")[0]+"-"+cue.content;
                } else {
                    list.push({start:cue.start,end:cue.end,content:cue.content});
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

    toString() {return this.displayName}

}

ExternalMedia.IMAGE_DURATION=6;
ExternalMedia.IMAGEEXT=[".png",".jpg",".gif",".jpeg",".bmp"];
ExternalMedia.VIDEOEXT=[".mov",".mp4",".m4v",".avi",".webm"];
ExternalMedia.ALLEXT=ExternalMedia.IMAGEEXT.concat(ExternalMedia.VIDEOEXT);

module.exports=ExternalMedia;