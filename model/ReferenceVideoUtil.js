let Reference=require("../bower_components/theoreference/Reference");
let ReferenceVideo=require("./ReferenceVideo");
let WrapperController=require("../bower_components/webvtt/wrappers/WrapperController");
let fs=require("fs-extra");
let path=require("path");
let escapeStringRegexp=require("escape-string-regexp");

class ReferenceVideoUtil {

    constructor(videopath) {
        // Video path is the path under which all video files are housed. Subdirectories ok.
        this.videopath=videopath;
        this.videoAppController=new WrapperController();
        this.videoApp=this.videoAppController.wrapper;
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
        for( var p of pathwalk ) {
            f=p.split(path.sep).pop();
            ext=f.split(".").pop().toLowerCase();
            if( ReferenceVideoUtil.VIDEOEXT.indexOf(ext)>=0 ) videos.push(p);
            else if( ReferenceVideoUtil.WEBVTTEXT.indexOf(ext)>=0 ) webvtts.push(p);
        }
        this.videos=videos.reverse(); // Reverse to get higher def versions as first choice.
        this.webvtts=webvtts;
    }

    /*
     *  createVideo: Receives a reference and returns a ReferenceVideo object
     *  that knows how to exactly play that reference from the video.
     * 
     */
    createVideo(reference,cb) {
        // RegEx: /BOOKSYMBOL_something_CHAPTER_r999p.ext
        if( reference.valid() ) {
            var chapter="0*"+reference.chapter.toString();
            var baseFileRegex=
                escapeStringRegexp(path.sep)+
                reference.publication.symbol+"_"+
                "\\w+_"+
                chapter+"_"+
                "r\\d{3}p\\.\\w{3}";
            var videoRegex=new RegExp(baseFileRegex+"$","i");
            var webvttRegex=new RegExp(baseFileRegex+"\\.\\w{3,6}$","i");
            var videoFile=this.videos.find(value=>videoRegex.test(value));
            var webvttFile=this.webvtts.find(value=>webvttRegex.test(value));
            if( !videoFile ) {
                // No video file. Report the error.
                console.log(`No video file for ${reference.toString()}.`);
                cb({code:"novideo",tag:"Not Found",message:"Video file could not be found!"},new ReferenceVideo(reference));
            } else if( !webvttFile ) {
                // If no webvtt file, then create one and send stuff.
                console.log(`No webvtt file for ${videoFile}. Make one now.`);
                if( this.videoApp ) {
                    this.videoApp.createWebVTT(videoFile,(err,webvtt)=>{
                        if( err ) {
                            console.error(err.toString());
                            cb({code:"indexerr",tag:"Index Error",message:err.toString()},new ReferenceVideo(reference,videoFile));
                        } else {
                            var webvttpath=videoFile+".webvtt";
                            this.webvtts.push(webvttpath);
                            fs.writeFileSync(webvttpath, webvtt.toString());
                            console.log(`Created ${webvttpath}!`);
                            cb(null,new ReferenceVideo(reference,videoFile,webvtt));
                        } 
                    });
                } else {
                    cb({code:"indexerr",tag:"Index Error",message:"No application available to index video!"},new ReferenceVideo(reference,videoFile));
                }
            } else {
                // All is well. Read the webvtt file and send stuff.
                fs.readFile(webvttFile,{encoding:"UTF-8"},(err,webvtt)=>{
                    console.log(`Read ${webvttFile}.`);
                    cb(null,new ReferenceVideo(reference,videoFile,webvtt));
                });
            }
        }
    }

}

ReferenceVideoUtil.VIDEOEXT = ["mp4","m4v","mov"];
ReferenceVideoUtil.WEBVTTEXT = ["webvtt","vtt"];

module.exports=ReferenceVideoUtil;