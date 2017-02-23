let ScriptureVideo=require("./ScriptureVideo");
let fs=require("fs-extra");

class ScriptureVideoUtil {

    constructor(videopath) {
        // Video path is the path under which all video files are housed. Subdirectories ok.
        this.videopath=videopath;
        return this;
    }

    get videopath(){return this._videopath}
    set videopath(path) {
        this._videopath=path||"";
        // Keep a list of all the videos
        var pathwalk=[];
        try {
            pathwalk=fs.walkSync(this.videopath);
        } catch(err) {}
        var videos=[], webvtts=[], f, ext;
        for( var path of pathwalk ) {
            f=path.split("/").pop();
            ext=f.split(".").pop().toLowerCase();
            if( ScriptureVideoUtil.VIDEOEXT.indexOf(ext)>=0 ) videos.push(path);
            else if( ScriptureVideoUtil.WEBVTTEXT.indexOf(ext)>=0 ) webvtts.push(path);
        }
        console.log(`Found ${pathwalk.length} items in video path, resulting in ${videos.length} videos and ${webvtts.length} webvtt files.`);
        this.videos=videos.reverse(); // Reverse to get higher def versions as first choice.
        this.webvtts=webvtts;
    }

    /*
     *  createVideo: Receives a scripture and returns a ScriptureVideo object
     *  that knows how to exactly play that scripture from the video.
     * 
     */
    createVideo(scripture) {
        // RegEx: /something_BOOKNUM_BOOKSYMBOL_something_CHAPTER_r999p.ext
        if( scripture.valid() ) {
            var booknum=(scripture.book.num<10?"0":"")+scripture.book.num.toString();
            var chapter=(scripture.chapter<10?"0":"")+scripture.chapter.toString();
            var baseFileRegex=
                "\/\\w+_"+
                booknum+"_"+
                scripture.book.symbol+"_"+
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
            return new ScriptureVideo(scripture,videoFile,webvtt);
        }
    }

}

ScriptureVideoUtil.VIDEOEXT = ["mp4","m4v","mov"];
ScriptureVideoUtil.WEBVTTEXT = ["webvtt","vtt"];

module.exports=ScriptureVideoUtil;