const REGEX=require("theoreference/RegEx");
let Cue=require("./Cue");
let Reference=require("theoreference/Reference");
let ReferenceVideo=require("./ReferenceVideo");
let WrapperController=require("webvtt/wrappers/WrapperController");
let fs=require("fs-extra");
let path=require("path");
let escapeStringRegexp=require("escape-string-regexp");

class ReferenceVideoUtil {

    constructor(videopaths="", videoAppController, cacheManager) {
        this.videos=[];
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
        for( var videopath of this._videopaths ) {
            var pathwalk=[];
            try {
                pathwalk=fs.walkSync(videopath);
            } catch(err) {}
            pathwalk.forEach(p=>this.addVideo(p));
        }
        this.videos.reverse(); // Reverse to get higher def versions as first choice.
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

    createStudyVideos(reference,cb){
        if( reference ) {
            this.createVideo(reference,(err,refvid)=>{
                // Add one more cue to the reference's cue list, to include the question
                var ref=refvid.reference;
                var lastCue=ref.cues[ref.cues.length-1];
                if( ref.availableCues.length>lastCue+1 ) ref.cues.push(lastCue+1);
                // We receive a reference video and use it to find all the cues.
                var refvids=[], prevart=[], cues=[], parCnt=0;
                // Note that boundary regex initially detects "P"aragraph cues. 
                let BOUNDARY_REGEX=/^(title|opening|subheading|box|art|par|review|summary|presentation|p\s|q\s|r\s)/i;
                refvid.webvtt.data.map(cue=>{
                    // First make a bunch of cue objects
                    return new Cue(cue.start,cue.end,cue.content,cue.id);
                }).forEach((cue,index)=>{
                    // If this cue is outside the range of cues for the reference, exclude it
                    if( ! ref.cues.includes(index) ) return;
                    // Then loop thru them, finding the "boundary" cues, and lumping together all cues that make up a paragraph
                    const PAR_REGEX=/^p\s(\d+)/i;
                    let lastCue=cues.length?cues[cues.length-1]:null;
                    cue.boundary=BOUNDARY_REGEX.test(cue.content);
                    // If a paragraph cue, simplify its appearance. i.e. "P 1a" becomes "P 1".
                    var parmatch=PAR_REGEX.exec(cue.content);
                    if( parmatch ) {
                        cue.content=`P ${parmatch[1]}`;
                        parCnt+=1;
                    }
                    // If last cue and this cue are not boundary cues, and their IDs are sequential, lump these together.
                    if( lastCue && ! lastCue.boundary && Number(lastCue.id)+1==Number(cue.id) && ! cue.boundary ) {
                        var contents=lastCue.content.split("-");
                        /*
                            Only change the paragraph range according to these circumstances:
                            - The first and last are not paragraph cues
                            - The first and last both are par cues (this eliminates the range showing scriptures in middle or end of a par range)
                            - The cues are not the same (for pars, meaning they are not two sides of a 1a-1b kind of scenario)
                        */
                        if( PAR_REGEX.test(contents[0])===PAR_REGEX.test(cue.content) && cue.content!==contents[0] ) {
                            contents[1]=parmatch?parmatch[1]:cue.content; // If a par, second side of range should only show number, i.e. "P 1-2"
                            lastCue.content=contents.join("-");
                        }
                        lastCue.id=cue.id;
                        lastCue.end=cue.end;
                        lastCue.max=cue.max;
                    } else {
                        cues.push(cue);
                    }
                    // For the first par found, we chg the boundary regex to not see "P"aragraph cues.
                    // We also change the cue.boundary flag so that the next cue match logic will work right.
                    if( parCnt===1 && cue.boundary && parmatch ) {
                        cue.boundary=false;
                        // After the first cue is recorded, stop having "P"aragraph cues be viewed as boundary cues.
                        BOUNDARY_REGEX=/^(title|opening|subheading|box|art|par|review|summary|presentation|q\s|r\s)/i;
                    }
                });
                // Eliminate dupe "Art 1 Caption" and "Art 1" companion cues
                var goodCues=cues.filter((cue,index,array)=>{
                    const ARTMATCH_REGEX=/^art\s(?:Caption\s)?(\d+)\s*.*/i;
                    var artmatch=cue.content.match(ARTMATCH_REGEX);
                    // If no art match, or its first cue, its ok.
                    if( ! artmatch || index==0 ) return true;
                    // Otherwise, see if previous cue matches, and if so, do not include this one
                    var prevartmatch=array[index-1].content.match(ARTMATCH_REGEX);
                    return ! ( prevartmatch && prevartmatch[1]===artmatch[1] );
                });
                refvid.list=goodCues;
                cb(null,refvid);
            });
        }
    }

    /*
     *  findAvailablePublications: Return an array of publications that are 
     *  available in the videos index.
     */
    findAvailablePublications(pubs) {
        var baseFileRegex=
            escapeStringRegexp(path.sep)+
            "([a-z0-9\\-]+)_"+ // Symbol
            "\\w+_"+
            "(\\d+_)?"+ // Date
            "\\d+_"+ // Chapter
            "r\\d{3}p\\.\\w{3}";
        var videoRegex=new RegExp(baseFileRegex+"$","i");
        var symbols=this.videos.filter(video=>{
            return videoRegex.test(video);
        }).map(video=>{
            return video.match(videoRegex)[1].toLowerCase();
        }).filter(function(elem, index, self) {
            return index===self.indexOf(elem);
        });
        return pubs.filter(pub=>{
            return symbols.includes(pub.symbol.toLowerCase());
        }).sort((a,b)=>{
            // Case-insensitive and exclude non-alphanumeric characters
            var aname=a.name.toLowerCase().replace(/[^a-z0-9]/,"");
            var bname=b.name.toLowerCase().replace(/[^a-z0-9]/,"");
            return aname.localeCompare(bname);
        });
    }

    /*
     *  findAvailableDates: Return an array of dates that are available
     *  in the videos index for the given publication.
     * 
     */
    findAvailableDates(pub) {
        var baseFileRegex=
            escapeStringRegexp(path.sep)+
            pub.symbol+"_"+ // Symbol
            "\\w+_"+
            (pub.hasDates?`(\\d{4,8})_`:``)+ // Date
            "(\\d+)_"+ // Chapter
            "r\\d{3}p\\.\\w{3}";
        var videoRegex=new RegExp(baseFileRegex+"$","i");
        var videoFiles=this.videos.filter(video=>videoRegex.test(video));
        return videoFiles.map(video=>{
            return video.match(videoRegex)[1];
        }).sort().reverse().filter((item,pos,ary)=>{
            return !pos || item != ary[pos-1];
        }).map(date=>{
            return moment(date,"YYYYMMDD");
        });
    }

    /*
     *  findAvailableChapters: Return an array of chapters that are available
     *  in the videos index for the given publication.
     * 
     */
    findAvailableChapters(pub) {
        var date=pub.date;
        var datemask="YYYYMM"+(pub.isOldWatchtower()?"DD":"");
        var baseFileRegex=
            escapeStringRegexp(path.sep)+
            pub.symbol+"_"+ // Symbol
            "\\w+_"+
            (pub.hasDates?(date?`${date.format(datemask)}_`:``):``)+ // Date
            "(\\d+)_"+ // Chapter
            "r\\d{3}p\\.\\w{3}";
        var videoRegex=new RegExp(baseFileRegex+"$","i");
        var videoFiles=this.videos.filter(video=>videoRegex.test(video));
        return videoFiles.map(video=>{
            return video.match(videoRegex)[1];
        }).sort().filter((item,pos,ary)=>{
            return !pos || item != ary[pos-1];
        }).map(chapter=>{
            return Number(chapter);
        });
    }

    addVideo(newpath) {
        var ext=path.extname(newpath).toLowerCase();
        if( ReferenceVideoUtil.VIDEOEXT.includes(ext) ) 
            this.videos.push(newpath);
    }
    removeVideo(oldpath) {
        if( this.hasVideo(oldpath) )
            this.videos=this.videos.filter(item=>item!==oldpath);
    }
    hasVideo(somepath) {
        return this.videos.includes(somepath);
    }
    
}

ReferenceVideoUtil.VIDEOEXT = [".mp4",".m4v",".mov"];

module.exports=ReferenceVideoUtil;