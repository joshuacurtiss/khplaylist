const ExternalMedia=require("./ExternalMedia");
let WrapperController=require("webvtt/wrappers/WrapperController");
let escapeStringRegexp=require("escape-string-regexp");
let fs=require("fs-extra");
let path=require("path");

class ExternalMediaUtil {

    constructor(mediapaths="", videoAppController) {
        this.media=[];
        // Media paths are the paths under which all media files are housed.
        this.mediapaths=mediapaths;
        this.videoAppController=videoAppController || new WrapperController();
        this.videoApp=this.videoAppController.wrapper;
        return this;
    }

    get mediapaths(){return this._mediapaths}
    set mediapaths(mediapaths="") {
        this._mediapaths=Array.isArray(mediapaths)?mediapaths:[mediapaths];
        // Keep a list of all the media
        for( var mediapath of this._mediapaths ) {
            var pathwalk=[];
            try {
                pathwalk=fs.walkSync(mediapath);
            } catch(err) {}
            pathwalk.forEach(p=>this.addMedia(p));
        }
        console.log(`Found ${this.media.length} media files.`);
        this.media.reverse(); // Reverse to get higher def versions as first choice.
    }

    /*  
     *  parseExternalMedia:  Receives text and parses it into an array of ExternalMedia objects.
     *  It outputs an array even if only one object is matched. 
     * 
     */

    parseExternalMedia(text) {
        var objs=this.parseExternalMediaWithIndex(text);
        return objs.map(item=>item.obj);
    }

    parseExternalMediaWithIndex(text) {
        var objs=[], match, re=this.getPathRegEx();
        while(match=re.exec(text)) {
            let webvtt=[];
            let p=match[0];
            // TODO: This will find the first match. But if more than one match, it should return negative.
            let matchedPath=this.media.find(m=>{
                var exactmatch=(m==p.trim());
                var re=new RegExp(escapeStringRegexp(path.sep+p.trim())+`$`,`i`);
                var filematch=re.test(m);
                return exactmatch || filematch;
            });
            if( matchedPath ) p=matchedPath;
            let media=new ExternalMedia(p,webvtt);
            media.pathIsIndexed=this.media.includes(p);
            if( fs.existsSync(p) ) {
                console.log(`Getting data. Valid: ${media.valid()}. Is video: ${media.isVideo()}`)
                if( media.valid() && media.isVideo() ) {
                    let info=this.videoApp.getInfoSync(p);
                    media.webvtt=[{
                        id: 0,
                        start: info.start,
                        end: info.duration,
                        name: media.filename
                    }];
                }
            }
            objs.push({obj:media,index:match.index});
        }
        return objs;
    }

    /*
     *  createVideo: Receives an ExternalMedia object, checks on it, and sends it
     *  back if all is well.  If not, though, It will report errors. For instance,
     *  if file doesn't exist or if the video info failed to be retrieved.  This is
     *  a little weird behavior for this object, but it's made to stay consistent 
     *  with the ReferenceVideoUtil and ScriptureVideoUtil objects. 
     * 
     */
    createVideo(media,cb) {
        if( ! media.valid() ) {
            // Isn't actually a real file. Report the error.
            console.log(`No file for ${media.toString()}.`);
            cb({code:"novideo",tag:"Not Found",message:"File could not be found!"},media);
        } else if( media.isVideo() && media.list.length==0 ) {
            // No list means we couldn't get details on the video.
            cb({code:"indexerr",tag:"Index Error",message:"No application available to index video!"},media);
        } else {
            // All is well. Just pass the media file right back.
            cb(null,media);
        }
    }

    addMedia(newpath) {
        var ext=path.extname(newpath).toLowerCase();
        if( ExternalMedia.ALLEXT.includes(ext) ) 
            this.media.push(newpath);
    }
    addVideo(newpath) {addMedia(newpath)}

    removeMedia(oldpath) {
        if( this.media.includes(oldpath) )
            this.media=this.media.filter(item=>item!==oldpath);
    }
    removeVideo(oldpath) {removeMedia(oldpath)}

    /*
     *  getPathRegEx: Takes the simpler PATH_REGEX constant and subs out the EXTENSIONS
     *  placeholder with all of the actual extensions we use for external media.
     * 
     */
    getPathRegEx() {
        var exts=ExternalMedia.ALLEXT;
        return RegExp(ExternalMediaUtil.PATH_REGEX.source.replace("EXTENSIONS",exts.join("|")),ExternalMediaUtil.PATH_REGEX.flags);
    }

}

ExternalMediaUtil.PATH_REGEX=/(?:[a-z]:)?(?:[a-z0-9 !@#\$%\^&\(\)\-=_\+\[\]{}\|'",\.\/\\])+(?:EXTENSIONS)/igm

module.exports=ExternalMediaUtil;