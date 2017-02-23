let ReferenceVideo=require("./ReferenceVideo");
let fs=require("fs-extra");

class ReferenceVideoUtil {

    constructor(videopath) {
        // Video path is the path under which all video files are housed. Subdirectories ok.
        this.videopath=videopath;
        return this;
    }

    get videopath(){return this._videopath}
    set videopath(path) {
        this._videopath=path||"";
        // Keep a list of all the videos
        var pathwalk=fs.walkSync(this.videopath);
        var videos=[], webvtts=[], f, ext;
        for( var path of pathwalk ) {
            f=path.split("/").pop();
            ext=f.split(".").pop().toLowerCase();
            if( ReferenceUtil.VIDEOEXT.indexOf(ext)>=0 ) videos.push(path);
            else if( ReferenceUtil.WEBVTTEXT.indexOf(ext)>=0 ) webvtts.push(path);
        }
        this.videos=videos.reverse(); // Reverse to get higher def versions as first choice.
        this.webvtts=webvtts;
    }

    /*
     *  createVideo: Receives a publication and returns a ScriptureVideo object
     *  that knows how to exactly play that scripture from the video.
     * 
     */
    createVideo(reference) {
        // RegEx: /BOOKSYMBOL_something_CHAPTER_r999p.ext
        if( reference.valid() ) {
            var chapter="0*"+reference.chapter.toString();
            var baseFileRegex=
                "\/"+
                reference.publication.symbol+"_"+
                "\\w+_"+
                chapter+"_"+
                "r\\d{3}p\\.\\w{3}";
            var videoRegex=new RegExp(baseFileRegex+"$","i");
            var webvttRegex=new RegExp(baseFileRegex+"\\.\\w{3,6}$","i");
            var videoFile=this.videos.find((value)=>{return videoRegex.test(value)});
            var webvttFile=this.webvtts.find((value)=>{return webvttRegex.test(value)});
            // TODO: Handle if file doesn't exist, create webvtt on the fly.
            var webvtt="";
            try {
                webvtt=fs.readFileSync(webvttFile,"UTF-8");
            } catch (error) {}
            return new ReferenceVideo(reference,videoFile,webvtt);
        }
    }

}

ReferenceVideoUtil.VIDEOEXT = ["mp4","m4v","mov"];
ReferenceVideoUtil.WEBVTTEXT = ["webvtt","vtt"];

module.exports=ReferenceVideoUtil;