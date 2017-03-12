let Scripture=require("../bower_components/scripture/Scripture");
let ScriptureVideo=require("./ScriptureVideo");
let WrapperController=require("../bower_components/webvtt/wrappers/WrapperController");
let fs=require("fs-extra");
let path=require("path");
let escapeStringRegexp=require("escape-string-regexp");

class ScriptureVideoUtil {

    constructor(videopath) {
        // Video path is the path under which all video files are housed. Subdirectories ok.
        this.videopath=videopath;
        this.videoAppController=new WrapperController();
        this.videoApp=this.videoAppController.wrapper;
        return this;
    }

    get videopath(){return this._videopath}
    set videopath(videopath) {
        this._videopath=videopath||"";
        // Keep a list of all the videos
        var pathwalk=[];
        try {
            pathwalk=fs.walkSync(this.videopath);
        } catch(err) {}
        var videos=[], webvtts=[], f, ext;
        for( var p of pathwalk ) {
            f=p.split(path.sep).pop();
            ext=f.split(".").pop().toLowerCase();
            if( ScriptureVideoUtil.VIDEOEXT.indexOf(ext)>=0 ) videos.push(p);
            else if( ScriptureVideoUtil.WEBVTTEXT.indexOf(ext)>=0 ) webvtts.push(p);
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
    createVideo(scripture,cb) {
        // RegEx: /something_BOOKNUM_BOOKSYMBOL_something_CHAPTER_r999p.ext
        if( scripture.valid() ) {
            var booknum=(scripture.book.num<10?"0":"")+scripture.book.num.toString();
            var chapter=(scripture.chapter<10?"0":"")+scripture.chapter.toString();
            var baseFileRegex=
                escapeStringRegexp(path.sep)+"\\w+_"+
                booknum+"_"+
                scripture.book.symbol+"_"+
                "\\w+_"+
                chapter+"_"+
                "r\\d{3}p\\.\\w{3}";
            var videoRegex=new RegExp(baseFileRegex+"$","i");
            var webvttRegex=new RegExp(baseFileRegex+"\\.\\w{3,6}$","i");
            var videoFile=this.videos.find((value)=>{return videoRegex.test(value)});
            var webvttFile=this.webvtts.find((value)=>{return webvttRegex.test(value)});
            if( !videoFile ) {
                // If no video file for the chapter, try looking for the verses
                let versevideos=[];
                for( var v of scripture.verses ) {
                    videoRegex=new RegExp(
                        escapeStringRegexp(path.sep)+"\\w+_\\w+_"+
                        "0{0,1}"+booknum+"-"+
                        "0{0,2}"+chapter+"-"+
                        "0{0,2}"+v+"_"+
                        "r\\d{3}p\\.\\w{3}$","i");
                    videoFile=this.videos.find((value)=>{return videoRegex.test(value)});
                    if( videoFile ) {
                        console.log(`For verse ${v}, I found "${videoFile}"`);
                        // TODO: Using getInfoSync() significantly reduces performance. Can we use promises/fibers to keep it asynchronous?
                        let info=this.videoApp.getInfoSync(videoFile);
                        let webvtt=[{
                            id: 0,
                            start: info.start,
                            end: info.duration,
                            name: `${scripture.book.name} ${scripture.chapter}:${v}`
                        }];
                        let scrip=new Scripture(scripture.book,scripture.chapter,v);
                        console.log(`Verse ${v} should be at position ${scripture.verses.indexOf(v)}.`);
                        versevideos.push(new ScriptureVideo(scrip,videoFile,webvtt));
                    }
                }
                // Send videos, or if still no video file found, return error indicating no video file.
                if( versevideos.length==scripture.verses.length ) {
                    cb(null,versevideos);
                } else {
                    console.log(`No video file for ${scripture.toString()}.`);
                    cb({code:"novideo",tag:"Not Found",message:"Video file could not be found!"},new ScriptureVideo(scripture));
                }
            } else if( !webvttFile ) {
                // If no webvtt file, then create one and send stuff.
                console.log(`No webvtt file for ${videoFile}. Make one now.`);
                if( this.videoApp ) {
                    this.videoApp.createWebVTT(videoFile,(err,webvtt)=>{
                        if( err ) {
                            console.error(err.toString());
                            cb({code:"indexerr",tag:"Index Error",message:err.toString()},new ScriptureVideo(scripture,videoFile));
                        } else {
                            var webvttpath=videoFile+".webvtt";
                            this.webvtts.push(webvttpath);
                            fs.writeFileSync(webvttpath, webvtt.toString());
                            console.log(`Created ${webvttpath}!`);
                            cb(null,new ScriptureVideo(scripture,videoFile,webvtt));
                        } 
                    });
                } else {
                    cb({code:"indexerr",tag:"Index Error",message:"No application available to index video!"},new ScriptureVideo(scripture,videoFile));
                }
            } else {
                // All is well. Read the webvtt file and send stuff.
                fs.readFile(webvttFile,{encoding:"UTF-8"},(err,webvtt)=>{
                    console.log(`Read ${webvttFile}.`);
                    cb(null,new ScriptureVideo(scripture,videoFile,webvtt));
                });
            }
        }
    }

}

ScriptureVideoUtil.VIDEOEXT = ["mp4","m4v","mov"];
ScriptureVideoUtil.WEBVTTEXT = ["webvtt","vtt"];

module.exports=ScriptureVideoUtil;