const REGEX=require("../bower_components/theoreference/RegEx");
let Reference=require("../bower_components/theoreference/Reference");
let ReferenceVideo=require("./ReferenceVideo");
let WrapperController=require("../bower_components/webvtt/wrappers/WrapperController");
let fs=require("fs-extra");
let path=require("path");
let escapeStringRegexp=require("escape-string-regexp");

class ReferenceVideoUtil {

    constructor(videopaths="", videoAppController, cacheManager) {
        // Video path is the path under which all video files are housed. Subdirectories ok.
        this.videopaths=videopaths;
        this.videoAppController=videoAppController || new WrapperController();
        this.videoApp=this.videoAppController.wrapper;
        this.cacheManager=cacheManager;
        return this;
    }

    get videopaths(){return this._videopaths}
    set videopaths(videopaths="") {
        this._videopaths=Array.isArray(videopaths)?videopaths:[videopaths];
        // Keep a list of all the videos
        var videos=[], webvtts=[], f, ext;
        for( var videopath of this._videopaths ) {
            var pathwalk=[];
            try {
                pathwalk=fs.walkSync(videopath);
            } catch(err) {}
            for( var p of pathwalk ) {
                f=path.basename(p);
                ext=path.extname(f).toLowerCase();
                if( ReferenceVideoUtil.VIDEOEXT.indexOf(ext)>=0 ) videos.push(p);
            }
        }
        this.videos=videos.reverse(); // Reverse to get higher def versions as first choice.
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
            var date=reference.publication.date;
            var datemask="YYYYMM"+(reference.publication.isOldWatchtower()?"DD":"");
            var baseFileRegex=
                escapeStringRegexp(path.sep)+
                reference.publication.symbol+"_"+
                "\\w+_"+
                (date?`${date.format(datemask)}_`:``)+
                chapter+"_"+
                "r\\d{3}p\\.\\w{3}";
            var videoRegex=new RegExp(baseFileRegex+"$","i");
            var webvttRegex=new RegExp(baseFileRegex+"\\.\\w{3,6}$","i");
            var videoFile=this.videos.find(value=>videoRegex.test(value));
            var webvttFile=this.cacheManager.findWebvttFile(videoFile);
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
                            // Report the WebVTT creation error
                            console.error(err.toString());
                            cb({code:"indexerr",tag:"Index Error",message:err.toString()},new ReferenceVideo(reference,videoFile));
                        } else if( webvtt.data.length ) {
                            // Generated WebVTT is good. Save it and use it.
                            var webvttpath=this.cacheManager.saveWebvttFile(videoFile,webvtt.toString());
                            console.log(`Created ${webvttpath}!`);
                            cb(null,new ReferenceVideo(reference,videoFile,webvtt));
                        } else {
                            // WebVTT was empty. Don't save it, make a fake webvtt for one-time use.
                            let info=this.videoApp.getInfoSync(videoFile);
                            webvtt=[{
                                id: 0,
                                start: info.start,
                                end: info.duration,
                                name: `${reference.publication.name} ${reference.chapter}`
                            }];
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

    createStudyVideos(reference,opts,cb){
        const DEFAULTOPTS={includeArt: true};
        // Handle if no opts are passed in.
        if( cb===undefined && typeof opts==="function" ) {
            cb=opts;
            opts={};
        }
        var options=Object.assign(DEFAULTOPTS, opts);
        if( reference ) {
            this.createVideo(reference,(err,refvid)=>{
                var ref=refvid.reference;
                // Establish the cues. Add one more, to get the last question
                var cues=ref.cues.slice();
                var lastCueIndex=cues[cues.length-1];
                if( lastCueIndex+1 < ref.availableCues.length ) cues.push(lastCueIndex+1);
                // Loop thru the cues and find all art and question cues.
                var refvids=[], prevart=[];
                var goodCues=ref.availableCues.filter((cue,index)=>{
                    var good=cues.includes(index) && /^(q\s|art|box)/i.test(cue);
                    var artmatch=cue.match(/^art(?:\sCaption)?\s(\d+)\s*.*/i);
                    if( ! artmatch ) return good;
                    if( ! prevart.includes(artmatch[1]) && options.includeArt ) prevart.push(artmatch[1]);
                    else good=false;
                    return good;
                });
                // Each "good" cue should be a separate reference video:
                goodCues.forEach(cue=>{
                    var parmatch=cue.match(/^q\s(.+)/i);
                    var p=parmatch?parmatch[1]:cue;
                    var r=new Reference(ref.publication, ref.chapter.toString(), p);
                    refvids.push(new ReferenceVideo(r,refvid.path,refvid.webvtt));
                });
                cb(null,refvids);
            });
        }
    }
    
}

ReferenceVideoUtil.VIDEOEXT = [".mp4",".m4v",".mov"];

module.exports=ReferenceVideoUtil;